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
import {
  AppSetting,
  BaseMaterial,
  expandAllPartMaterials,
  PartSet,
  PartSetItem,
  SubmarinePart,
} from '@ff14/entities';
import {
  CreatePartSetDto,
  PartSetProfit,
  UNIVERSALIS_WORLD_KEY,
  UniversalisSettings,
  UpdatePartSetDto,
} from '@ff14/types';
import { UpdatePriceDto } from './dto/update-price.dto';
import { UpdateWorldDto } from './dto/update-world.dto';

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

  /** Publishes a manual Universalis price refresh job to the price-worker via RabbitMQ. */
  triggerRefresh(): { status: string } {
    this.rmqClient.emit('universalis_price_refresh', { force: true });
    return { status: 'queued' };
  }

  // ── Universalis settings ────────────────────────────────────────────────

  /** Returns the configured Universalis world (DB value -> env -> 'Louisoix') */
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

  /** Persists the Universalis world used by the price-worker sync */
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

    // Prices fetched for the old world are no longer representative
    await this.cache.reset();

    return { world, source: 'database' };
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
      // Exclude "part-as-material" rows: submarine parts that also exist in
      // base_materials (so recipes can reference them) must not appear in
      // the market pricing list — they are crafted in-house, not market items
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

  // ── Part sets (persistent profitability bundles) ────────────────────────

  /** Effective valuation for a material: manual override > market > NPC */
  private effectivePriceOf(mat: BaseMaterial | null | undefined): number {
    if (!mat) return 0;
    return mat.myPrice ?? mat.marketPrice ?? mat.npcPrice ?? 0;
  }

  /**
   * Raw-material crafting cost for one unit of every part, using the fully
   * expanded recipe chain and each material's effective price. Profit is
   * always computed on read, so any price change reflects immediately.
   */
  private buildSetCostContext(allParts: SubmarinePart[]): {
    costPerPart: Map<string, number>;
  } {
    const matById = new Map<string, BaseMaterial>();
    for (const p of allParts) {
      for (const pm of p.materials ?? []) {
        if (pm.material) matById.set(pm.material.id, pm.material);
      }
    }
    const expanded = expandAllPartMaterials(allParts);

    const costPerPart = new Map<string, number>();
    for (const p of allParts) {
      let cost = 0;
      for (const req of expanded.get(p.id) ?? []) {
        cost += this.effectivePriceOf(matById.get(req.materialId)) * req.quantity;
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
    const ctx = this.buildSetCostContext(allParts);
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

    const ctx = this.buildSetCostContext(allParts);
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

    const ctx = this.buildSetCostContext(allParts);
    return this.mapToProfit(updated, ctx);
  }

  async deleteSet(id: string): Promise<void> {
    const res = await this.setRepo.delete(id);
    if (!res.affected) throw new NotFoundException(`Part set "${id}" not found`);
  }
}
