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
    return this.partRepo.find({
      order: { name: 'ASC' },
      relations: ['materials', 'materials.material'],
    });
  }

  async findOne(id: string): Promise<SubmarinePart> {
    const part = await this.partRepo.findOne({
      where: { id },
      relations: ['materials', 'materials.material'],
    });
    if (!part) throw new NotFoundException(`Part "${id}" not found`);
    return part;
  }

  /**
   * Recalculates desiredQuantity for every BaseMaterial based on:
   * sum(part.desiredStock * partMaterial.quantity) across all registered submarine parts.
   */
  async recalculateMaterialTargets(): Promise<{
    updatedCount: number;
    totalRequirements: Record<string, number>;
  }> {
    // 1. Fetch all submarine parts with their material relations
    const parts = await this.partRepo.find({
      relations: ['materials', 'materials.material'],
    });

    // 2. Aggregate required raw materials
    const materialDesiredMap = new Map<string, number>();

    for (const part of parts) {
      const partTarget = part.desiredStock || 0;
      if (partTarget > 0 && part.materials) {
        for (const pm of part.materials) {
          if (pm.material) {
            const matId = pm.material.id;
            const currentTotal = materialDesiredMap.get(matId) || 0;
            materialDesiredMap.set(matId, currentTotal + partTarget * pm.quantity);
          }
        }
      }
    }

    // 3. Fetch all base materials and update desiredQuantity
    const allMaterials = await this.ds.getRepository(BaseMaterial).find();
    const requirementsObj: Record<string, number> = {};

    await this.ds.transaction(async (em) => {
      for (const mat of allMaterials) {
        const calculatedTarget = materialDesiredMap.get(mat.id) || 0;
        requirementsObj[mat.name] = calculatedTarget;
        if (mat.desiredQuantity !== calculatedTarget) {
          mat.desiredQuantity = calculatedTarget;
          await em.save(mat);
        }
      }
    });

    await this.cache.reset();
    return { updatedCount: allMaterials.length, totalRequirements: requirementsObj };
  }

  async updateTarget(id: string, desiredStock: number): Promise<SubmarinePart> {
    const part = await this.findOne(id);
    part.desiredStock = Math.max(0, desiredStock);
    await this.partRepo.save(part);
    await this.recalculateMaterialTargets();
    return this.findOne(id);
  }

  async create(dto: CreatePartDto): Promise<SubmarinePart> {
    const { materials, ...partData } = dto;

    const saved = await this.ds.transaction(async (em) => {
      const part = em.create(SubmarinePart, partData);
      await em.save(part);

      for (const m of (materials ?? [])) {
        const material = await em.findOne(BaseMaterial, {
          where: { id: m.materialId },
        });
        if (!material) {
          throw new NotFoundException(`Material "${m.materialId}" not found`);
        }
        await em.save(em.create(PartMaterial, { part, material, quantity: m.quantity }));
      }

      return em.findOne(SubmarinePart, {
        where: { id: part.id },
        relations: ['materials', 'materials.material'],
      });
    });

    await this.recalculateMaterialTargets();
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

      return em.findOne(SubmarinePart, {
        where: { id: part.id },
        relations: ['materials', 'materials.material'],
      });
    });

    await this.recalculateMaterialTargets();
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
    await this.recalculateMaterialTargets();
    await this.cache.reset();
  }
}