import { Controller, Inject, Logger, Optional } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  BaseMaterial,
  CharacterInventory,
  MaterialSource,
  RetainerInventory,
  StoredBag,
  SubmarinePart,
} from '@ff14/entities';
import { readEnvelope } from '@ff14/internal-auth';

interface PluginItem {
  itemId: number;
  itemName: string;
  quantity: number;
  isHQ?: boolean;
}

interface PluginBag {
  bagName: string;
  items: PluginItem[];
}

interface PluginIngestPayload {
  characterName?: string;
  homeWorld?: string;
  timestamp?: string;
  playerInventory?: PluginBag[];
  retainers?: PluginRetainer[];
}

interface PluginRetainer {
  retainerName: string;
  bags: PluginBag[];
}

const GIL_ITEM_ID = 1;

@Controller()
export class IngestConsumer {
  private readonly logger = new Logger(IngestConsumer.name);

  constructor(
    @InjectRepository(BaseMaterial)
    private readonly materialRepo: Repository<BaseMaterial>,
    @InjectRepository(SubmarinePart)
    private readonly partRepo: Repository<SubmarinePart>,
    @InjectRepository(CharacterInventory)
    private readonly charInvRepo: Repository<CharacterInventory>,
    @InjectRepository(RetainerInventory)
    private readonly retainerInvRepo: Repository<RetainerInventory>,
    @Optional() @Inject(CACHE_MANAGER) private readonly cache?: Cache,
  ) {}

  /**
   * Recomputes stock levels from the server-side inventory cache.
   *
   * The service persists the incoming report into character_inventories /
   * retainer_inventories before emitting this event, so the message payload
   * is only used for logging — the stock aggregation always runs over the
   * whole cache (every character + every retainer), which keeps counts
   * correct across multiple devices and characters.
   */
  @EventPattern('inventory_ingest')
  async handleIngest(@Payload() envelope: unknown): Promise<void> {
    const data = readEnvelope<PluginIngestPayload>(envelope);
    if (!data) {
      this.logger.warn('Rejected inventory_ingest message with invalid or missing internal token');
      return;
    }

    const [cachedCharacters, cachedRetainers] = await Promise.all([
      this.charInvRepo.find(),
      this.retainerInvRepo.find(),
    ]);

    const bagsBySource: Array<[string, StoredBag[]]> = [
      ...cachedCharacters.map(
        (c) =>
          [`character ${c.characterName} (${c.homeWorld ?? 'unknown world'})`, c.bags ?? []] as [
            string,
            StoredBag[],
          ],
      ),
      ...cachedRetainers.map((r) => [`retainer ${r.retainerName}`, r.bags ?? []] as [string, StoredBag[]]),
    ];

    const stockByItemId = new Map<number, { qty: number; name: string }>();
    let totalItems = 0;

    for (const [source, bags] of bagsBySource) {
      let sourceItems = 0;
      for (const bag of bags) {
        for (const item of bag.items ?? []) {
          if (item.itemId === GIL_ITEM_ID) continue; // skip Gil
          sourceItems += item.quantity;
          const existing = stockByItemId.get(item.itemId);
          if (existing) {
            existing.qty += item.quantity;
          } else {
            stockByItemId.set(item.itemId, {
              qty: item.quantity,
              name: item.itemName ?? '',
            });
          }
        }
      }
      totalItems += sourceItems;
      this.logger.debug(`${source}: ${sourceItems} item(s) counted`);
    }

    this.logger.log(
      `Inventory ingest triggered by "${data.characterName ?? 'unknown'}" — recomputing from ` +
        `${cachedCharacters.length} character(s) and ${cachedRetainers.length} retainer(s) in cache ` +
        `(${stockByItemId.size} unique items, ${totalItems} total)`,
    );

    const [allMaterials, allParts] = await Promise.all([
      this.materialRepo.find(),
      this.partRepo.find({ relations: [] }), // we don't need materials relation here
    ]);

    const matByItemId = new Map<number, BaseMaterial>();
    const matByName   = new Map<string, BaseMaterial>(); // fallback
    for (const m of allMaterials) {
      if (m.itemId) matByItemId.set(m.itemId, m);
      matByName.set(m.name.toLowerCase(), m);
    }

    const partByItemId = new Map<number, SubmarinePart>();
    const partByName   = new Map<string, SubmarinePart>(); // fallback
    for (const p of allParts) {
      if (p.itemId) partByItemId.set(p.itemId, p);
      partByName.set(p.name.toLowerCase(), p);
    }

    const matsToSave:  BaseMaterial[]  = [];
    const partsToSave: SubmarinePart[] = [];

    for (const [itemId, { qty, name }] of stockByItemId.entries()) {
      const nameKey = name.toLowerCase();

      const mat = matByItemId.get(itemId) ?? matByName.get(nameKey);
      if (mat) {
        if (mat.whereToBuy === MaterialSource.NPC) {
          if (mat.currentStock !== mat.desiredQuantity) {
            mat.currentStock = mat.desiredQuantity;
            matsToSave.push(mat);
          }
        } else if (mat.currentStock !== qty) {
          mat.currentStock = qty;
          matsToSave.push(mat);
        }
      }

      const part = partByItemId.get(itemId) ?? partByName.get(nameKey);
      if (part && part.stock !== qty) {
        part.stock = qty;
        partsToSave.push(part);
      }
    }

    for (const part of allParts) {
      if (part.itemId && !stockByItemId.has(part.itemId) && part.stock !== 0) {
        part.stock = 0;
        partsToSave.push(part);
      }
    }
    for (const mat of allMaterials) {
      if (!mat.itemId || stockByItemId.has(mat.itemId)) continue;
      const target =
        mat.whereToBuy === MaterialSource.NPC ? mat.desiredQuantity : 0;
      if (mat.currentStock !== target) {
        mat.currentStock = target;
        matsToSave.push(mat);
      }
    }

    await Promise.all([
      matsToSave.length  ? this.materialRepo.save(matsToSave)  : Promise.resolve(),
      partsToSave.length ? this.partRepo.save(partsToSave)     : Promise.resolve(),
    ]);

    this.logger.log(
      `Inventory ingest complete. ` +
      `Updated ${matsToSave.length} material(s) and ${partsToSave.length} part(s).`,
    );

    if (this.cache) {
      try {
        await this.cache.reset();
      } catch (err: unknown) {
        this.logger.warn(`Failed to reset cache: ${(err as Error).message}`);
      }
    }
  }
}
