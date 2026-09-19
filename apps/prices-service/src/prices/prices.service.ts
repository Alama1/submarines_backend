import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ClientProxy } from '@nestjs/microservices';
import { createEnvelope } from '@ff14/internal-auth';
import {
  AppSetting,
  BaseMaterial,
  computeCraftCosts,
  effectivePriceOf,
  expandAllPartMaterials,
  MaterialCostInfo,
  PartSet,
  PartSetItem,
  SubmarinePart,
} from '@ff14/entities';
import {
  AnomalyThresholds,
  ANOMALY_THRESHOLD_GIL_KEY,
  ANOMALY_THRESHOLD_PCT_KEY,
  CreatePartSetDto,
  MaterialIngredientCost,
  PartSetProfit,
  PRICE_ANOMALY_THRESHOLD_PCT,
  PriceAnomaliesResponse,
  PriceAnomalyItem,
  UNIVERSALIS_WORLD_KEY,
  UniversalisSettings,
  UpdatePartSetDto,
} from '@ff14/types';
import { UpdatePriceDto } from './dto/update-price.dto';
import { UpdateWorldDto } from './dto/update-world.dto';
import { UpdateAnomalyThresholdsDto } from './dto/update-anomaly-thresholds.dto';

export interface MaterialPriceItem {
  id: string;
  name: string;
  itemId: number | null;
  marketPrice: number | null;
  myPrice: number | null;
  npcPrice: number | null;
  effectivePrice: number;
  whereToBuy: string;
  updatedAt: Date;
}

@Injectable()
export class PricesService {
  constructor(
    @InjectRepository(BaseMaterial)
    private readonly repo: Repository<BaseMaterial>,
    @InjectRepository(SubmarinePart)
    private readonly partRepo: Repository<SubmarinePart>,
    @InjectRepository(AppSetting)
    private readonly settingRepo: Repository<AppSetting>,
    @InjectRepository(PartSet)
    private readonly setRepo: Repository<PartSet>,
    @InjectDataSource()
    private readonly ds: DataSource,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @Inject('PRICE_RMQ_CLIENT') private readonly rmqClient: ClientProxy,
    private readonly config: ConfigService,
  ) {}

  triggerRefresh(): { status: string } {
    this.rmqClient.emit('universalis_price_refresh', createEnvelope({ force: true }));
    return { status: 'queued' };
  }

  async getUniversalisSettings(): Promise<UniversalisSettings> {
    const row = await this.settingRepo.findOne({
      where: { key: UNIVERSALIS_WORLD_KEY },
    });
    const dbValue = row?.value?.trim();
    if (dbValue) {
      return { world: dbValue, source: 'database' };
    }
    return {
      world: this.config.get<string>('UNIVERSALIS_WORLD', 'Louisoix'),
      source: 'default',
    };
  }

  async updateUniversalisWorld(dto: UpdateWorldDto): Promise<UniversalisSettings> {
    const world = dto.world.trim();

    const existing = await this.settingRepo.findOne({
      where: { key: UNIVERSALIS_WORLD_KEY },
    });
    if (existing) {
      existing.value = world;
      await this.settingRepo.save(existing);
    } else {
      await this.settingRepo.insert({
        key: UNIVERSALIS_WORLD_KEY,
        value: world,
      });
    }

    await this.cache.reset();

    return { world, source: 'database' };
  }

  private parseThreshold(raw: string | null | undefined): number | null {
    const trimmed = raw?.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  async getAnomalyThresholds(): Promise<AnomalyThresholds> {
    const rows = await this.settingRepo.find({
      where: [
        { key: ANOMALY_THRESHOLD_PCT_KEY },
        { key: ANOMALY_THRESHOLD_GIL_KEY },
      ],
    });
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    // Key absent -> use the default; key present but blank -> explicitly disabled.
    const pctRaw = byKey.get(ANOMALY_THRESHOLD_PCT_KEY);
    return {
      thresholdPct:
        pctRaw === undefined
          ? PRICE_ANOMALY_THRESHOLD_PCT
          : this.parseThreshold(pctRaw),
      thresholdGil: this.parseThreshold(byKey.get(ANOMALY_THRESHOLD_GIL_KEY)),
    };
  }

  async updateAnomalyThresholds(
    dto: UpdateAnomalyThresholdsDto,
  ): Promise<AnomalyThresholds> {
    const updates: Array<{ key: string; value: number | null }> = [];
    if (dto.thresholdPct !== undefined) {
      updates.push({ key: ANOMALY_THRESHOLD_PCT_KEY, value: dto.thresholdPct });
    }
    if (dto.thresholdGil !== undefined) {
      updates.push({ key: ANOMALY_THRESHOLD_GIL_KEY, value: dto.thresholdGil });
    }

    for (const { key, value } of updates) {
      const existing = await this.settingRepo.findOne({ where: { key } });
      const stored = value === null ? '' : String(value);
      if (existing) {
        existing.value = stored;
        await this.settingRepo.save(existing);
      } else {
        await this.settingRepo.insert({ key, value: stored });
      }
    }

    await this.cache.reset();
    return this.getAnomalyThresholds();
  }

  private mapToPriceItem(mat: BaseMaterial): MaterialPriceItem {
    const effectivePrice = mat.myPrice ?? mat.marketPrice ?? mat.npcPrice ?? 0;
    return {
      id: mat.id,
      name: mat.name,
      itemId: mat.itemId,
      marketPrice: mat.marketPrice,
      myPrice: mat.myPrice,
      npcPrice: mat.npcPrice,
      effectivePrice,
      whereToBuy: mat.whereToBuy,
      updatedAt: mat.updatedAt,
    };
  }

  async findAll(
    search?: string,
    page = 1,
    limit = 50,
  ): Promise<{ items: MaterialPriceItem[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('m')
      .leftJoin(SubmarinePart, 'p', 'LOWER(p.name) = LOWER(m.name)')
      .where('p.id IS NULL');
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

    const items = materials.map((m) => this.mapToPriceItem(m));
    return { items, total };
  }

  async findOne(id: string): Promise<MaterialPriceItem> {
    const mat = await this.repo.findOne({ where: { id } });
    if (!mat) throw new NotFoundException(`Material "${id}" not found`);
    return this.mapToPriceItem(mat);
  }

  async updateMyPrice(id: string, dto: UpdatePriceDto): Promise<MaterialPriceItem> {
    const mat = await this.repo.findOne({ where: { id } });
    if (!mat) throw new NotFoundException(`Material "${id}" not found`);

    mat.myPrice = dto.myPrice;
    const saved = await this.repo.save(mat);
    await this.cache.reset();
    return this.mapToPriceItem(saved);
  }

  async clearMyPrice(id: string): Promise<MaterialPriceItem> {
    const mat = await this.repo.findOne({ where: { id } });
    if (!mat) throw new NotFoundException(`Material "${id}" not found`);

    mat.myPrice = null;
    const saved = await this.repo.save(mat);
    await this.cache.reset();
    return this.mapToPriceItem(saved);
  }

  private effectivePriceOf(mat: BaseMaterial | null | undefined): number {
    if (!mat) return 0;
    return mat.myPrice ?? mat.marketPrice ?? mat.npcPrice ?? 0;
  }

  /**
   * Craft-cost comparison for all craftable materials: computed craft cost
   * (recursive, multi-tier, crystals included) vs the user's custom price.
   * A row is flagged when it deviates beyond the configured thresholds:
   * |diffPct| > thresholdPct OR |diff| > thresholdGil (null disables a check).
   */
  async findAnomalies(): Promise<PriceAnomaliesResponse> {
    const [materials, thresholds] = await Promise.all([
      this.repo.find(),
      this.getAnomalyThresholds(),
    ]);
    const matById = new Map<string, BaseMaterial>(
      materials.map((m) => [m.id, m]),
    );
    const costs = computeCraftCosts(matById);

    const items: PriceAnomalyItem[] = [];
    for (const mat of materials) {
      if (!mat.recipe?.length) continue;
      const info: MaterialCostInfo =
        costs.get(mat.id) ?? { craftCost: 0, incomplete: false };

      const ingredients: MaterialIngredientCost[] = mat.recipe
        .map((row) => {
          const ing = matById.get(row.ingredientMaterialId);
          const buy = ing ? effectivePriceOf(ing) : 0;
          const craft =
            ing ? (costs.get(row.ingredientMaterialId)?.craftCost ?? 0) : 0;
          const crafted = (ing?.recipe?.length ?? 0) > 0;
          const unitCost =
            buy > 0 && crafted
              ? Math.min(buy, craft)
              : crafted
                ? craft
                : buy;
          return {
            ingredientMaterialId: row.ingredientMaterialId,
            name: ing?.name ?? 'Unknown',
            quantity: row.quantity,
            unitCost,
            totalCost: unitCost * row.quantity,
            crafted,
          };
        })
        .sort((a, b) => b.totalCost - a.totalCost);

      const diff =
        mat.myPrice != null ? info.craftCost - mat.myPrice : null;
      const diffPct =
        diff != null && mat.myPrice ? (diff / mat.myPrice) * 100 : null;

      const isAnomaly =
        (thresholds.thresholdPct != null &&
          diffPct != null &&
          Math.abs(diffPct) > thresholds.thresholdPct) ||
        (thresholds.thresholdGil != null &&
          diff != null &&
          Math.abs(diff) > thresholds.thresholdGil);

      items.push({
        id: mat.id,
        name: mat.name,
        itemId: mat.itemId,
        myPrice: mat.myPrice,
        marketPrice: mat.marketPrice,
        whereToBuy: mat.whereToBuy,
        craftCost: info.craftCost,
        diff,
        diffPct,
        incomplete: info.incomplete,
        isAnomaly,
        ingredients,
      });
    }

    items.sort((a, b) => {
      if (a.diffPct == null && b.diffPct == null) {
        return b.craftCost - a.craftCost;
      }
      if (a.diffPct == null) return 1;
      if (b.diffPct == null) return -1;
      return Math.abs(b.diffPct) - Math.abs(a.diffPct);
    });

    const anomalyCount = items.filter((i) => i.isAnomaly).length;

    return { items, total: items.length, anomalyCount, thresholds };
  }

  private async buildSetCostContext(allParts: SubmarinePart[]): Promise<{
    costPerPart: Map<string, number>;
  }> {
    const materials = await this.repo.find();
    const matById = new Map<string, BaseMaterial>(
      materials.map((m) => [m.id, m]),
    );
    const costs = computeCraftCosts(matById);
    const expanded = expandAllPartMaterials(allParts);

    // Effective price wins; fall back to computed craft cost when a
    // craftable material has no price set at all (avoids silent 0-cost).
    const unitCostOf = (mat: BaseMaterial | null | undefined): number => {
      if (!mat) return 0;
      const effective = effectivePriceOf(mat);
      if (effective > 0) return effective;
      return costs.get(mat.id)?.craftCost ?? 0;
    };

    const costPerPart = new Map<string, number>();
    for (const p of allParts) {
      let cost = 0;
      for (const req of expanded.get(p.id) ?? []) {
        cost += unitCostOf(matById.get(req.materialId)) * req.quantity;
      }
      costPerPart.set(p.id, cost);
    }
    return { costPerPart };
  }

  private mapToProfit(set: PartSet, ctx: { costPerPart: Map<string, number> }): PartSetProfit {
    let totalSale = 0;
    let totalMaterialCost = 0;

    const items = (set.items ?? []).map((item: PartSetItem) => {
      const part = item.part;
      const unitSalePrice = part?.price ?? 0;
      const materialCostPerUnit = part ? (ctx.costPerPart.get(part.id) ?? 0) : 0;
      const saleTotal = unitSalePrice * item.quantity;
      const materialCostTotal = materialCostPerUnit * item.quantity;
      totalSale += saleTotal;
      totalMaterialCost += materialCostTotal;
      return {
        partId: part?.id ?? null,
        partName: item.partName,
        quantity: item.quantity,
        unitSalePrice,
        saleTotal,
        materialCostPerUnit,
        materialCostTotal,
        profit: saleTotal - materialCostTotal,
      };
    });

    return {
      id: set.id,
      name: set.name,
      description: set.description,
      items,
      totalSale,
      totalMaterialCost,
      totalProfit: totalSale - totalMaterialCost,
      profitMarginPct: totalSale > 0 ? Math.round(((totalSale - totalMaterialCost) / totalSale) * 100) : 0,
    };
  }

  private async loadPartsForSets(): Promise<SubmarinePart[]> {
    return this.partRepo.find({ relations: ['materials', 'materials.material'] });
  }

  private assertPartsExist(
    items: Array<{ partId: string }>,
    allParts: SubmarinePart[],
  ): Map<string, SubmarinePart> {
    const partsById = new Map(allParts.map((p) => [p.id, p]));
    for (const item of items) {
      if (!partsById.has(item.partId)) {
        throw new NotFoundException(`Submarine part "${item.partId}" not found`);
      }
    }
    return partsById;
  }

  async findSets(): Promise<{ items: PartSetProfit[]; total: number }> {
    const [sets, allParts] = await Promise.all([
      this.setRepo.find({ order: { createdAt: 'ASC' } }),
      this.loadPartsForSets(),
    ]);
    const ctx = await this.buildSetCostContext(allParts);
    return { items: sets.map((s) => this.mapToProfit(s, ctx)), total: sets.length };
  }

  async createSet(dto: CreatePartSetDto): Promise<PartSetProfit> {
    const allParts = await this.loadPartsForSets();
    const partsById = this.assertPartsExist(dto.items, allParts);

    const saved = await this.ds
      .transaction(async (em) => {
        const set = em.create(PartSet, {
          name: dto.name,
          description: dto.description ?? null,
          items: dto.items.map((i) =>
            em.create(PartSetItem, {
              part: partsById.get(i.partId)!,
              partName: partsById.get(i.partId)!.name,
              quantity: i.quantity,
            }),
          ),
        });
        return em.save(set);
      })
      .catch((err) => {
        if (err?.code === '23505') {
          throw new BadRequestException(`A set named "${dto.name}" already exists`);
        }
        throw err;
      });

    const ctx = await this.buildSetCostContext(allParts);
    return this.mapToProfit(saved, ctx);
  }

  async updateSet(id: string, dto: UpdatePartSetDto): Promise<PartSetProfit> {
    const allParts = await this.loadPartsForSets();

    const updated = await this.ds
      .transaction(async (em) => {
        const set = await em.findOne(PartSet, { where: { id } });
        if (!set) throw new NotFoundException(`Part set "${id}" not found`);

        if (dto.name !== undefined) set.name = dto.name;
        if (dto.description !== undefined) set.description = dto.description;
        await em.save(set);

        if (dto.items) {
          const partsById = this.assertPartsExist(dto.items, allParts);
          await em.delete(PartSetItem, { set: { id } });
          set.items = dto.items.map((i) =>
            em.create(PartSetItem, {
              part: partsById.get(i.partId)!,
              partName: partsById.get(i.partId)!.name,
              quantity: i.quantity,
            }),
          );
          await em.save(set);
        }

        return em.findOneOrFail(PartSet, { where: { id } });
      })
      .catch((err) => {
        if (err?.code === '23505') {
          throw new BadRequestException(`A set named "${dto.name ?? '?'}" already exists`);
        }
        throw err;
      });

    const ctx = await this.buildSetCostContext(allParts);
    return this.mapToProfit(updated, ctx);
  }

  async deleteSet(id: string): Promise<void> {
    const res = await this.setRepo.delete(id);
    if (!res.affected) throw new NotFoundException(`Part set "${id}" not found`);
  }
}
