import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { BaseMaterial, PartMaterial, SubmarinePart } from '@ff14/entities';
import { CreatePartDto } from './dto/create-part.dto';
import { UpdatePartDto } from './dto/update-part.dto';

@Injectable()
export class RecipesService {
  constructor(
    @InjectRepository(SubmarinePart)
    private readonly partRepo: Repository<SubmarinePart>,
    @InjectDataSource()
    private readonly ds: DataSource,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  findAll(): Promise<SubmarinePart[]> {
    return this.partRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<SubmarinePart> {
    const part = await this.partRepo.findOne({ where: { id } });
    if (!part) throw new NotFoundException(`Part "${id}" not found`);
    return part;
  }

  async create(dto: CreatePartDto): Promise<SubmarinePart> {
    const { materials, ...partData } = dto;

    const saved = await this.ds.transaction(async (em) => {
      const part = em.create(SubmarinePart, partData);
      await em.save(part);

      for (const m of materials) {
        const material = await em.findOne(BaseMaterial, {
          where: { id: m.materialId },
        });
        if (!material) {
          throw new NotFoundException(`Material "${m.materialId}" not found`);
        }
        await em.save(em.create(PartMaterial, { part, material, quantity: m.quantity }));
      }

      return em.findOne(SubmarinePart, { where: { id: part.id } });
    });

    await this.cache.reset();
    return saved as SubmarinePart;
  }

  async update(id: string, dto: UpdatePartDto): Promise<SubmarinePart> {
    const { materials, ...partData } = dto;

    const saved = await this.ds.transaction(async (em) => {
      const part = await em.findOne(SubmarinePart, { where: { id } });
      if (!part) throw new NotFoundException(`Part "${id}" not found`);

      Object.assign(part, partData);
      await em.save(part);

      if (materials !== undefined) {
        // Replace materials list atomically
        await em
          .createQueryBuilder()
          .delete()
          .from(PartMaterial)
          .where('"part_id" = :partId', { partId: id })
          .execute();

        for (const m of materials) {
          const material = await em.findOne(BaseMaterial, {
            where: { id: m.materialId },
          });
          if (!material) {
            throw new NotFoundException(`Material "${m.materialId}" not found`);
          }
          await em.save(em.create(PartMaterial, { part, material, quantity: m.quantity }));
        }
      }

      return em.findOne(SubmarinePart, { where: { id } });
    });

    await this.cache.reset();
    return saved as SubmarinePart;
  }

  async remove(id: string): Promise<void> {
    const part = await this.findOne(id);

    // Block deletion if part is in any non-cancelled order (order-worker needs it)
    const activeOrders: unknown[] = await this.ds.query(
      `SELECT oi.id
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.part_id = $1
         AND o.status NOT IN ('cancelled')
       LIMIT 1`,
      [id],
    );
    if (activeOrders.length > 0) {
      throw new ConflictException(
        'Part is referenced in active orders and cannot be deleted. Cancel the orders first.',
      );
    }

    await this.partRepo.remove(part);
    await this.cache.reset();
  }
}
