import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ClientProxy } from '@nestjs/microservices';
import { BaseMaterial, MaterialCategory, MaterialSource } from '@ff14/entities';
import { IngestDto } from './dto/ingest.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { UpdateTargetDto } from './dto/update-target.dto';

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

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(BaseMaterial)
    private readonly repo: Repository<BaseMaterial>,
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
  ): Promise<{ items: InventoryItemStock[]; total: number }> {
    const [materials, total] = await this.repo
      .createQueryBuilder('m')
      .where('m.current_stock < m.desired_quantity')
      .andWhere('m.category != :repair', { repair: MaterialCategory.REPAIR })
      .orderBy('(m.desired_quantity - m.current_stock)', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { items: materials.map((m) => this.mapToStockItem(m)), total };
  }

  async findOne(id: string): Promise<InventoryItemStock> {
    const mat = await this.repo.findOne({ where: { id } });
    if (!mat) throw new NotFoundException(`Material "${id}" not found`);
    return this.mapToStockItem(mat);
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
