import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseMaterial, MaterialSource } from '@ff14/entities';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';

@Injectable()
export class MaterialsService {
  constructor(
    @InjectRepository(BaseMaterial)
    private readonly repo: Repository<BaseMaterial>,
  ) {}

  async findAll(
    search?: string,
    page = 1,
    limit = 50,
  ): Promise<{ items: BaseMaterial[]; total: number }> {
    const qb = this.repo.createQueryBuilder('m');
    if (search) {
      qb.where('LOWER(m.name) LIKE :search', {
        search: `%${search.toLowerCase()}%`,
      });
    }
    const [items, total] = await qb
      .orderBy('m.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { items, total };
  }

  async findOne(id: string): Promise<BaseMaterial> {
    const mat = await this.repo.findOne({ where: { id } });
    if (!mat) throw new NotFoundException(`Material "${id}" not found`);
    return mat;
  }

  create(dto: CreateMaterialDto): Promise<BaseMaterial> {
    const mat = this.repo.create(dto);

    // NPC-sourced items are always stocked to the max (target quantity)
    if (mat.whereToBuy === MaterialSource.NPC) {
      mat.currentStock = mat.desiredQuantity ?? 0;
    }

    return this.repo.save(mat);
  }

  async update(id: string, dto: UpdateMaterialDto): Promise<BaseMaterial> {
    const existing = await this.findOne(id); // throws 404 if missing

    const effectiveSource = dto.whereToBuy ?? existing.whereToBuy;
    const effectiveTarget = dto.desiredQuantity ?? existing.desiredQuantity;

    const updates: Partial<BaseMaterial> = { ...dto };

    // Keep NPC-sourced items maxed out whenever source or target changes
    if (effectiveSource === MaterialSource.NPC) {
      updates.currentStock = effectiveTarget;
    }

    await this.repo.update(id, updates);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const mat = await this.findOne(id);
    try {
      await this.repo.remove(mat);
    } catch (err: unknown) {
      // PostgreSQL FK violation: 23503
      if ((err as { code?: string }).code === '23503') {
        throw new ConflictException(
          'Material is referenced in one or more recipes and cannot be deleted',
        );
      }
      throw err;
    }
  }
}
