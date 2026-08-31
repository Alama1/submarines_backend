import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ClientProxy } from '@nestjs/microservices';
import {
  BaseMaterial,
  MaterialCategory,
  MaterialClaim,
  MaterialSource,
} from '@ff14/entities';
import { IngestDto } from './dto/ingest.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { UpdateTargetDto } from './dto/update-target.dto';
import { CreateClaimDto } from './dto/create-claim.dto';

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

export interface MissingMaterialItem extends InventoryItemStock {
  /** Sum of all claim quantities against this material */
  claimed: number;
  /** deficit - claimed (never below 0) */
  remaining: number;
  claims: MaterialClaimSummary[];
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(BaseMaterial)
    private readonly repo: Repository<BaseMaterial>,
    @InjectRepository(MaterialClaim)
    private readonly claimRepo: Repository<MaterialClaim>,
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

  async findMissing(
    page = 1,
    limit = 50,
  ): Promise<{ items: MissingMaterialItem[]; total: number }> {
    const [materials, total] = await this.repo
      .createQueryBuilder('m')
      .where('m.current_stock < m.desired_quantity')
      .andWhere('m.category != :repair', { repair: MaterialCategory.REPAIR })
      .orderBy('(m.desired_quantity - m.current_stock)', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const claimsByMaterial = await this.getClaimsByMaterial(
      materials.map((m) => m.id),
    );

    const items = materials.map((m) => {
      const base = this.mapToStockItem(m);
      const claims = claimsByMaterial.get(m.id) ?? [];
      const claimed = claims.reduce((sum, c) => sum + c.quantity, 0);
      return {
        ...base,
        claimed,
        remaining: Math.max(0, base.deficit - claimed),
        claims,
      };
    });

    return { items, total };
  }

  /** Loads all claims for the given materials, grouped by material id */
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

  async findOne(id: string): Promise<InventoryItemStock> {
    const mat = await this.repo.findOne({ where: { id } });
    if (!mat) throw new NotFoundException(`Material "${id}" not found`);
    return this.mapToStockItem(mat);
  }

  // ── Claims ──────────────────────────────────────────────────────────────

  /** Lists all claims for a material together with a deficit summary */
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

  /** Creates a claim: a person pledges to deliver a quantity of the material */
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

  async ingest(dto: IngestDto): Promise<{ status: string; source: string }> {
    // Forward the full plugin payload to the inventory-worker via RabbitMQ.
    // The worker handles: flattening all player/retainer bags, summing by itemId,
    // and updating both base_materials.current_stock and submarine_parts.stock.
    this.rmqClient.emit('inventory_ingest', dto);
    return { status: 'accepted', source: dto.characterName ?? 'unknown' };
  }

  async updateStock(id: string, dto: UpdateStockDto): Promise<InventoryItemStock> {
    const mat = await this.repo.findOne({ where: { id } });
    if (!mat) throw new NotFoundException(`Material "${id}" not found`);

    // NPC-sourced items are always stocked to the max (target quantity)
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
