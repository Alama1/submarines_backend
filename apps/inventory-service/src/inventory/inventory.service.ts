import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ClientProxy } from '@nestjs/microservices';
import { createEnvelope } from '@ff14/internal-auth';
import {
  BaseMaterial,
  characterKeyOf,
  CharacterInventory,
  MaterialCategory,
  MaterialClaim,
  MaterialSource,
  RetainerInventory,
  StoredBag,
  SubmarinePart,
} from '@ff14/entities';
import { IngestDto, PluginBagDto, PluginRetainerDto } from './dto/ingest.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { UpdateTargetDto } from './dto/update-target.dto';
import { CreateClaimDto } from './dto/create-claim.dto';
import { NetWorthResponse } from '@ff14/types';

export interface InventoryItemStock {
  id: string;
  name: string;
  itemId: number | null;
  currentStock: number;
  desiredQuantity: number;
  deficit: number;
  whereToBuy: MaterialSource;
  category: MaterialCategory;
  updatedAt: Date;
}

export interface MaterialClaimSummary {
  id: string;
  materialId: string;
  claimedFor: string;
  quantity: number;
  createdAt: Date;
}

export interface ClaimWithMaterial extends MaterialClaimSummary {
  materialName: string;
  currentStock: number;
  desiredQuantity: number;
  deficit: number;
}

export interface MissingMaterialItem extends InventoryItemStock {
  claimed: number;
  remaining: number;
  claims: MaterialClaimSummary[];
  /** Raw materials demanded by current in-progress builds. */
  orderNeeded: number;
  /** Shortfall of that demand after current stock. */
  orderMissing: number;
  /** deficit + orderMissing — total units crafters need to gather. */
  totalMissing: number;
}

export interface IngestResponse {
  status: string;
  source: string;
  characterCached: boolean;
  retainersCached: number;
  staleSkipped: number;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectRepository(BaseMaterial)
    private readonly repo: Repository<BaseMaterial>,
    @InjectRepository(MaterialClaim)
    private readonly claimRepo: Repository<MaterialClaim>,
    @InjectRepository(CharacterInventory)
    private readonly charInvRepo: Repository<CharacterInventory>,
    @InjectRepository(RetainerInventory)
    private readonly retainerInvRepo: Repository<RetainerInventory>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @Inject('INVENTORY_RMQ_CLIENT') private readonly rmqClient: ClientProxy,
  ) {}

  private mapToStockItem(mat: BaseMaterial): InventoryItemStock {
    const deficit = Math.max(0, mat.desiredQuantity - mat.currentStock);
    return {
      id: mat.id,
      name: mat.name,
      itemId: mat.itemId,
      currentStock: mat.currentStock,
      desiredQuantity: mat.desiredQuantity,
      deficit,
      whereToBuy: mat.whereToBuy,
      category: mat.category,
      updatedAt: mat.updatedAt,
    };
  }

  async findAll(
    search?: string,
    page = 1,
    limit = 50,
  ): Promise<{ items: InventoryItemStock[]; total: number }> {
    const qb = this.repo.createQueryBuilder('m');
    qb.where('m.category != :repair', { repair: MaterialCategory.REPAIR });
    if (search) {
      qb.andWhere('LOWER(m.name) LIKE :search', {
        search: `%${search.toLowerCase()}%`,
      });
    }
    const [materials, total] = await qb
      .orderBy('m.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { items: materials.map((m) => this.mapToStockItem(m)), total };
  }

  async findRepairs(
    search?: string,
    page = 1,
    limit = 50,
  ): Promise<{ items: InventoryItemStock[]; total: number }> {
    const qb = this.repo.createQueryBuilder('m');
    qb.where('m.category = :repair', { repair: MaterialCategory.REPAIR });
    if (search) {
      qb.andWhere('LOWER(m.name) LIKE :search', {
        search: `%${search.toLowerCase()}%`,
      });
    }
    const [materials, total] = await qb
      .orderBy('m.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { items: materials.map((m) => this.mapToStockItem(m)), total };
  }

  /**
   * Per-material demand of all in-progress builds, straight from the
   * orders-service aggregate so both views always show the same numbers.
   */
  private async fetchOrderNeeds(): Promise<
    Map<string, { needed: number; missing: number }>
  > {
    const needs = new Map<string, { needed: number; missing: number }>();
    const base = process.env.ORDERS_SERVICE_URL;
    if (!base) return needs;

    try {
      const res = await fetch(
        `${base.replace(/\/$/, '')}/api/orders/in-progress`,
        {
          headers: { 'x-internal-token': process.env.INTERNAL_TOKEN ?? '' },
          signal: AbortSignal.timeout(3000),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as {
        aggregate?: {
          materials?: Array<{
            materialId: string;
            needed: number;
            missing: number;
          }>;
        };
      };
      for (const m of body.aggregate?.materials ?? []) {
        needs.set(m.materialId, { needed: m.needed, missing: m.missing });
      }
    } catch (err) {
      this.logger.warn(
        `Could not fetch in-progress order materials from orders-service (${(err as Error).message}) — /inventory/missing falls back to stock targets only`,
      );
    }
    return needs;
  }

  async findMissing(
    search?: string,
    page = 1,
    limit = 50,
  ): Promise<{ items: MissingMaterialItem[]; total: number }> {
    const orderNeeds = await this.fetchOrderNeeds();

    const qb = this.repo
      .createQueryBuilder('m')
      .leftJoin(SubmarinePart, 'p', 'LOWER(p.name) = LOWER(m.name)')
      .where('m.category != :repair', { repair: MaterialCategory.REPAIR })
      .andWhere('m.desiredQuantity > 0')
      .andWhere('p.id IS NULL');

    // No SQL pagination — the merged list is sorted and sliced in JS below.
    const materials = await qb
      .addSelect('m.desired_quantity - m.current_stock', 'deficit_calc')
      .orderBy('deficit_calc', 'DESC')
      .getMany();

    // Materials demanded only by in-progress builds (no stock target of their own).
    const orderOnlyIds = [...orderNeeds.keys()].filter(
      (id) => !materials.some((m) => m.id === id),
    );
    if (orderOnlyIds.length) {
      const extra = await this.repo.find({ where: { id: In(orderOnlyIds) } });
      materials.push(
        ...extra.filter((m) => m.category !== MaterialCategory.REPAIR),
      );
    }

    const claimsByMaterial = await this.getClaimsByMaterial(
      materials.map((m) => m.id),
    );

    let items = materials.map((m) => {
      const base = this.mapToStockItem(m);
      const claims = claimsByMaterial.get(m.id) ?? [];
      const claimed = claims.reduce((sum, c) => sum + c.quantity, 0);
      const order = orderNeeds.get(m.id);
      const orderNeeded = order?.needed ?? 0;
      const orderMissing = order?.missing ?? 0;
      // Orders consume shelf stock first; the target is refilled from
      // whatever stock survives the orders — never from the same stock twice.
      const stockLeftAfterOrders = Math.max(0, base.currentStock - orderNeeded);
      const totalMissing =
        base.whereToBuy === MaterialSource.NPC
          ? 0
          : orderMissing + Math.max(0, base.desiredQuantity - stockLeftAfterOrders);
      return {
        ...base,
        claimed,
        remaining: Math.max(0, totalMissing - claimed),
        claims,
        orderNeeded,
        orderMissing,
        totalMissing,
      };
    });

    if (search) {
      const q = search.toLowerCase();
      items = items.filter((m) => m.name.toLowerCase().includes(q));
    }

    items.sort(
      (a, b) =>
        b.totalMissing - a.totalMissing || a.name.localeCompare(b.name),
    );

    return {
      items: items.slice((page - 1) * limit, page * limit),
      total: items.length,
    };
  }

  private async getClaimsByMaterial(
    materialIds: string[],
  ): Promise<Map<string, MaterialClaimSummary[]>> {
    const grouped = new Map<string, MaterialClaimSummary[]>();
    if (!materialIds.length) return grouped;

    const claims = await this.claimRepo.find({
      where: { materialId: In(materialIds) },
      order: { createdAt: 'ASC' },
    });

    for (const claim of claims) {
      const list = grouped.get(claim.materialId) ?? [];
      list.push({
        id: claim.id,
        materialId: claim.materialId,
        claimedFor: claim.claimedFor,
        quantity: claim.quantity,
        createdAt: claim.createdAt,
      });
      grouped.set(claim.materialId, list);
    }

    return grouped;
  }

  private effectivePriceOf(mat: BaseMaterial): number {
    return mat.myPrice ?? mat.marketPrice ?? mat.npcPrice ?? 0;
  }

  /**
   * Net worth of all stock on hand, valued two ways:
   *  - marketNetWorth: universalis market price per unit (unpriced -> 0)
   *  - myNetWorth: the custom price where set, otherwise the effective price
   */
  async getNetWorth(): Promise<NetWorthResponse> {
    const materials = await this.repo.find();

    let marketNetWorth = 0;
    let myNetWorth = 0;
    let unpricedCount = 0;

    for (const mat of materials) {
      if (mat.currentStock <= 0) continue;
      if (this.effectivePriceOf(mat) === 0) unpricedCount++;
      marketNetWorth += mat.currentStock * (mat.marketPrice ?? 0);
      myNetWorth += mat.currentStock * this.effectivePriceOf(mat);
    }

    return {
      marketNetWorth,
      myNetWorth,
      materialCount: materials.length,
      unpricedCount,
    };
  }

  async findOne(id: string): Promise<InventoryItemStock> {
    const mat = await this.repo.findOne({ where: { id } });
    if (!mat) throw new NotFoundException(`Material "${id}" not found`);
    return this.mapToStockItem(mat);
  }

  async findAllClaims(): Promise<{ items: ClaimWithMaterial[]; total: number }> {
    const claims = await this.claimRepo.find({
      relations: ['material'],
      order: { createdAt: 'DESC' },
    });

    const items = claims.map((c) => {
      const mat = c.material;
      return {
        id: c.id,
        materialId: c.materialId,
        claimedFor: c.claimedFor,
        quantity: c.quantity,
        createdAt: c.createdAt,
        materialName: mat?.name ?? 'Unknown material',
        currentStock: mat?.currentStock ?? 0,
        desiredQuantity: mat?.desiredQuantity ?? 0,
        deficit: mat ? Math.max(0, mat.desiredQuantity - mat.currentStock) : 0,
      };
    });

    return { items, total: items.length };
  }

  async findClaims(materialId: string): Promise<{
    material: Pick<InventoryItemStock, 'id' | 'name' | 'currentStock' | 'desiredQuantity'>;
    deficit: number;
    totalClaimed: number;
    remaining: number;
    claims: MaterialClaimSummary[];
  }> {
    const mat = await this.repo.findOne({ where: { id: materialId } });
    if (!mat) throw new NotFoundException(`Material "${materialId}" not found`);

    const claims = await this.claimRepo.find({
      where: { materialId },
      order: { createdAt: 'ASC' },
    });

    const deficit = Math.max(0, mat.desiredQuantity - mat.currentStock);
    const totalClaimed = claims.reduce((sum, c) => sum + c.quantity, 0);

    return {
      material: {
        id: mat.id,
        name: mat.name,
        currentStock: mat.currentStock,
        desiredQuantity: mat.desiredQuantity,
      },
      deficit,
      totalClaimed,
      remaining: Math.max(0, deficit - totalClaimed),
      claims: claims.map((c) => ({
        id: c.id,
        materialId: c.materialId,
        claimedFor: c.claimedFor,
        quantity: c.quantity,
        createdAt: c.createdAt,
      })),
    };
  }

  async createClaim(materialId: string, dto: CreateClaimDto): Promise<MaterialClaimSummary> {
    const mat = await this.repo.findOne({ where: { id: materialId } });
    if (!mat) throw new NotFoundException(`Material "${materialId}" not found`);

    const claim = await this.claimRepo.save(
      this.claimRepo.create({
        materialId,
        claimedFor: dto.claimedFor.trim(),
        quantity: dto.quantity,
      }),
    );

    return {
      id: claim.id,
      materialId: claim.materialId,
      claimedFor: claim.claimedFor,
      quantity: claim.quantity,
      createdAt: claim.createdAt,
    };
  }

  async deleteClaim(claimId: string): Promise<void> {
    const claim = await this.claimRepo.findOne({ where: { id: claimId } });
    if (!claim) throw new NotFoundException(`Claim "${claimId}" not found`);
    await this.claimRepo.remove(claim);
  }

  /**
   * Ingest a plugin report into the server-side inventory cache.
   *
   * The cache is the source of truth and lives in the database, keyed per
   * character and per retainer, so reports from any number of devices or
   * characters merge instead of overwriting each other:
   *  - the character inventory row is replaced only when the incoming scan is
   *    newer than what is stored;
   *  - each retainer row is replaced only when the incoming scan is newer
   *    (protects against stale device-local retainer caches).
   *
   * New plugins send `characters[]` with one entry per cached character (each
   * entry carrying that character's own retainers), so switching characters or
   * machines never loses data. Older plugins send only the top-level
   * character/retainer fields, which are handled as a single-character report.
   *
   * After persisting, the inventory worker recomputes stock levels from the
   * whole cache (all characters + all retainers), not just this report.
   */
  async ingest(dto: IngestDto): Promise<IngestResponse> {
    const reportedAt = this.parseTimestamp(dto.timestamp) ?? new Date();
    const source = dto.characterName?.trim() || 'unknown';

    let characterCached = false;
    let retainersCached = 0;
    let staleSkipped = 0;

    for (const entry of this.buildCharacterEntries(dto, reportedAt)) {
      const ownerKey = characterKeyOf(entry.characterName, entry.homeWorld);

      const existing = await this.charInvRepo.findOne({
        where: { characterKey: ownerKey },
      });
      if (existing && existing.lastReportedAt.getTime() >= entry.reportedAt.getTime()) {
        staleSkipped++;
      } else if (existing) {
        existing.characterName = entry.characterName;
        existing.homeWorld = entry.homeWorld ?? null;
        existing.bags = entry.playerInventory ?? [];
        existing.lastReportedAt = entry.reportedAt;
        await this.charInvRepo.save(existing);
        characterCached = true;
      } else {
        await this.charInvRepo.save(
          this.charInvRepo.create({
            characterKey: ownerKey,
            characterName: entry.characterName,
            homeWorld: entry.homeWorld ?? null,
            bags: entry.playerInventory ?? [],
            lastReportedAt: entry.reportedAt,
          }),
        );
        characterCached = true;
      }

      for (const retainer of entry.retainers ?? []) {
        const retainerId = this.normalizeRetainerId(retainer.retainerId);
        if (!retainerId) continue;

        const retainerUpdatedAt =
          this.parseTimestamp(retainer.lastUpdated) ?? entry.reportedAt;
        const existingRetainer = await this.retainerInvRepo.findOne({
          where: { retainerId },
        });
        if (
          existingRetainer &&
          existingRetainer.lastReportedAt.getTime() >= retainerUpdatedAt.getTime()
        ) {
          staleSkipped++;
          continue;
        }

        if (existingRetainer) {
          existingRetainer.retainerName = retainer.retainerName;
          existingRetainer.ownerKey = ownerKey;
          existingRetainer.bags = (retainer.bags ?? []) as StoredBag[];
          existingRetainer.lastReportedAt = retainerUpdatedAt;
          await this.retainerInvRepo.save(existingRetainer);
        } else {
          await this.retainerInvRepo.save(
            this.retainerInvRepo.create({
              retainerId,
              retainerName: retainer.retainerName,
              ownerKey,
              bags: (retainer.bags ?? []) as StoredBag[],
              lastReportedAt: retainerUpdatedAt,
            }),
          );
        }
        retainersCached++;
      }
    }

    this.rmqClient.emit('inventory_ingest', createEnvelope(dto));

    return {
      status: 'accepted',
      source,
      characterCached,
      retainersCached,
      staleSkipped,
    };
  }

  /**
   * Normalises a report into a list of per-character entries. Reports with a
   * `characters` array are expanded as-is; legacy reports (top-level fields
   * only) become a single entry.
   */
  private buildCharacterEntries(
    dto: IngestDto,
    reportedAt: Date,
  ): Array<{
    characterName: string;
    homeWorld?: string;
    reportedAt: Date;
    playerInventory?: PluginBagDto[];
    retainers?: PluginRetainerDto[];
  }> {
    if (dto.characters?.length) {
      return dto.characters
        .filter((c) => c.characterName?.trim())
        .map((c) => ({
          characterName: c.characterName.trim(),
          homeWorld: c.homeWorld?.trim() || undefined,
          reportedAt: this.parseTimestamp(c.timestamp) ?? reportedAt,
          playerInventory: c.playerInventory,
          retainers: c.retainers,
        }));
    }

    const name = dto.characterName?.trim();
    if (!name) return [];

    return [
      {
        characterName: name,
        homeWorld: dto.homeWorld?.trim() || undefined,
        reportedAt,
        playerInventory: dto.playerInventory,
        retainers: dto.retainers,
      },
    ];
  }

  private parseTimestamp(value?: string): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  /** Accepts string digits (preferred) or number (legacy); returns bigint-as-string. */
  private normalizeRetainerId(value: unknown): string | null {
    if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
      return BigInt(value.trim()).toString();
    }
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      return BigInt(Math.trunc(value)).toString();
    }
    return null;
  }

  async findCachedCharacters(): Promise<CharacterInventory[]> {
    return this.charInvRepo.find({ order: { lastReportedAt: 'DESC' } });
  }

  async findCachedRetainers(): Promise<RetainerInventory[]> {
    return this.retainerInvRepo.find({ order: { lastReportedAt: 'DESC' } });
  }

  async deleteCachedCharacter(id: string): Promise<void> {
    const row = await this.charInvRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Cached character "${id}" not found`);
    await this.charInvRepo.remove(row);
    this.rmqClient.emit('inventory_ingest', createEnvelope({}));
  }

  async deleteCachedRetainer(retainerId: string): Promise<void> {
    const row = await this.retainerInvRepo.findOne({
      where: { retainerId },
    });
    if (!row) {
      throw new NotFoundException(`Cached retainer "${retainerId}" not found`);
    }
    await this.retainerInvRepo.remove(row);
    this.rmqClient.emit('inventory_ingest', createEnvelope({}));
  }

  async updateStock(id: string, dto: UpdateStockDto): Promise<InventoryItemStock> {
    const mat = await this.repo.findOne({ where: { id } });
    if (!mat) throw new NotFoundException(`Material "${id}" not found`);

    mat.currentStock =
      mat.whereToBuy === MaterialSource.NPC ? mat.desiredQuantity : dto.stock;
    const saved = await this.repo.save(mat);
    await this.cache.reset();
    return this.mapToStockItem(saved);
  }

  async updateTarget(id: string, dto: UpdateTargetDto): Promise<InventoryItemStock> {
    const mat = await this.repo.findOne({ where: { id } });
    if (!mat) throw new NotFoundException(`Material "${id}" not found`);

    mat.desiredQuantity = dto.desiredQuantity;
    if (mat.whereToBuy === MaterialSource.NPC) {
      mat.currentStock = dto.desiredQuantity;
    }
    const saved = await this.repo.save(mat);
    await this.cache.reset();
    return this.mapToStockItem(saved);
  }
}
