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
import { BaseMaterial } from '@ff14/entities';
import { UpdatePriceDto } from './dto/update-price.dto';

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
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @Inject('PRICE_RMQ_CLIENT') private readonly rmqClient: ClientProxy,
  ) {}

  /** Publishes a manual Universalis price refresh job to the price-worker via RabbitMQ. */
  triggerRefresh(): { status: string } {
    this.rmqClient.emit('universalis_price_refresh', { force: true });
    return { status: 'queued' };
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
    const qb = this.repo.createQueryBuilder('m');
    if (search) {
      qb.where('LOWER(m.name) LIKE :search', {
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
}
