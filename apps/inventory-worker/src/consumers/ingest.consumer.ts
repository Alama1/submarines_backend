import { Controller, Inject, Logger, Optional } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { BaseMaterial, MaterialSource, SubmarinePart } from '@ff14/entities';

// ─── Payload shapes (mirrors the plugin DTOs) ────────────────────────────────

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

interface PluginRetainer {
  retainerName: string;
  bags: PluginBag[];
}

interface PluginIngestPayload {
  characterName?: string;
  homeWorld?: string;
  timestamp?: string;
  playerInventory?: PluginBag[];
  retainers?: PluginRetainer[];
}

// ─── Gil item ID — skip from stock updates ────────────────────────────────────
const GIL_ITEM_ID = 1;

@Controller()
export class IngestConsumer {
  private readonly logger = new Logger(IngestConsumer.name);

  constructor(
    @InjectRepository(BaseMaterial)
    private readonly materialRepo: Repository<BaseMaterial>,
    @InjectRepository(SubmarinePart)
    private readonly partRepo: Repository<SubmarinePart>,
    @Optional() @Inject(CACHE_MANAGER) private readonly cache?: Cache,
  ) {}

  @EventPattern('inventory_ingest')
  async handleIngest(@Payload() data: PluginIngestPayload): Promise<void> {
    if (!data) {
      this.logger.warn('Received empty inventory_ingest payload');
      return;
    }

    // ── Step 1: flatten all bags (player + all retainers) into a map: itemId → total qty ──
    const stockByItemId = new Map<number, { qty: number; name: string }>();

    const accumulateBags = (bags: PluginBag[] | undefined) => {
      if (!bags) return;
      for (const bag of bags) {
        for (const item of bag.items ?? []) {
          if (item.itemId === GIL_ITEM_ID) continue; // skip Gil
          const existing = stockByItemId.get(item.itemId);
          if (existing) {
            existing.qty += item.quantity;
          } else {
            stockByItemId.set(item.itemId, {
              qty: item.quantity,
              name: item.itemName,
            });
          }
        }
      }
    };

    // Player bags
    accumulateBags(data.playerInventory);

    // Retainer bags
    for (const retainer of data.retainers ?? []) {
      accumulateBags(retainer.bags);
    }

    this.logger.log(
      `Inventory ingest from "${data.characterName ?? 'unknown'}" — ` +
      `${stockByItemId.size} unique items across player + ${data.retainers?.length ?? 0} retainers`,
    );

    // ── Step 2: load all known base_materials and submarine_parts ─────────────────────────
    const [allMaterials, allParts] = await Promise.all([
      this.materialRepo.find(),
      this.partRepo.find({ relations: [] }), // we don't need materials relation here
    ]);

    // Build lookup maps for fast matching: itemId → entity
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

    // ── Step 3: match and update ──────────────────────────────────────────────────────────
    const matsToSave:  BaseMaterial[]  = [];
    const partsToSave: SubmarinePart[] = [];

    for (const [itemId, { qty, name }] of stockByItemId.entries()) {
      const nameKey = name.toLowerCase();

      // Try base_materials first
      const mat = matByItemId.get(itemId) ?? matByName.get(nameKey);
      if (mat) {
        // NPC-sourced items are always stocked to the max (target quantity),
        // regardless of what the plugin reports
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

      // Also try submarine_parts — crafted parts exist in base_materials too
      // (they are ingredients of the "Modified" recipes), so the same itemId
      // must be able to update both tables
      const part = partByItemId.get(itemId) ?? partByName.get(nameKey);
      if (part && part.stock !== qty) {
        part.stock = qty;
        partsToSave.push(part);
      }
    }

    // ── Step 4: items absent from the snapshot ─────────────────────────────
    // The plugin sends a FULL inventory snapshot. A tracked item that is no
    // longer reported is no longer owned, so its stock must drop (otherwise
    // it freezes at the last non-zero value when items are traded/sold away).
    for (const part of allParts) {
      if (part.itemId && !stockByItemId.has(part.itemId) && part.stock !== 0) {
        part.stock = 0;
        partsToSave.push(part);
      }
    }
    for (const mat of allMaterials) {
      if (!mat.itemId || stockByItemId.has(mat.itemId)) continue;
      // Keep the NPC pinning rule for absent NPC-sourced materials
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

    // Bust Redis cache so next API call returns fresh stock
    if (this.cache) {
      try {
        await this.cache.reset();
      } catch (err: unknown) {
        this.logger.warn(`Failed to reset cache: ${(err as Error).message}`);
      }
    }
  }
}
