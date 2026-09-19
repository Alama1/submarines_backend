import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  BaseMaterial,
  MaterialCategory,
  MaterialIngredient,
  MaterialSource,
} from '@ff14/entities';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';

@Injectable()
export class MaterialsService {
  constructor(
    @InjectRepository(BaseMaterial)
    private readonly repo: Repository<BaseMaterial>,
    @InjectDataSource()
    private readonly ds: DataSource,
  ) {}

  async findAll(
    search?: string,
    page = 1,
    limit = 50,
  ): Promise<{ items: BaseMaterial[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.recipe', 'ri')
      .leftJoinAndSelect('ri.ingredient', 'ing');
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
    const mat = await this.repo.findOne({
      where: { id },
      relations: ['recipe', 'recipe.ingredient'],
    });
    if (!mat) throw new NotFoundException(`Material "${id}" not found`);
    return mat;
  }

  async create(dto: CreateMaterialDto): Promise<BaseMaterial> {
    const ingredients = dto.ingredients;
    await this.assertIngredientsValid(ingredients, null);

    const mat = await this.ds.transaction(async (em) => {
      const entity = em.create(BaseMaterial, {
        name: dto.name,
        itemId: dto.itemId ?? null,
        desiredQuantity: dto.desiredQuantity ?? 0,
        myPrice: dto.myPrice ?? null,
        npcPrice: dto.npcPrice ?? null,
        whereToBuy: dto.whereToBuy ?? MaterialSource.MARKET,
        category: dto.category ?? MaterialCategory.CRAFTING,
      });

      if (entity.whereToBuy === MaterialSource.NPC) {
        entity.currentStock = entity.desiredQuantity;
      }

      await em.save(entity);

      if (ingredients?.length) {
        await this.replaceRecipe(em, entity.id, ingredients);
      }

      return em.findOne(BaseMaterial, {
        where: { id: entity.id },
        relations: ['recipe', 'recipe.ingredient'],
      });
    });

    return mat!;
  }

  async update(id: string, dto: UpdateMaterialDto): Promise<BaseMaterial> {
    const existing = await this.findOne(id); // throws 404 if missing

    if (dto.ingredients !== undefined) {
      await this.assertIngredientsValid(dto.ingredients, id);
    }

    await this.ds.transaction(async (em) => {
      const effectiveSource = dto.whereToBuy ?? existing.whereToBuy;
      const effectiveTarget = dto.desiredQuantity ?? existing.desiredQuantity;

      const updates: Partial<BaseMaterial> = {};
      if (dto.name !== undefined) updates.name = dto.name;
      if (dto.itemId !== undefined) updates.itemId = dto.itemId;
      if (dto.desiredQuantity !== undefined) updates.desiredQuantity = dto.desiredQuantity;
      if (dto.myPrice !== undefined) updates.myPrice = dto.myPrice;
      if (dto.npcPrice !== undefined) updates.npcPrice = dto.npcPrice;
      if (dto.whereToBuy !== undefined) updates.whereToBuy = dto.whereToBuy;
      if (dto.category !== undefined) updates.category = dto.category;

      if (effectiveSource === MaterialSource.NPC) {
        updates.currentStock = effectiveTarget;
      }

      await em.update(BaseMaterial, id, updates);

      if (dto.ingredients !== undefined) {
        await this.replaceRecipe(em, id, dto.ingredients);
      }
    });

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const mat = await this.findOne(id);
    try {
      await this.repo.remove(mat);
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23503') {
        throw new ConflictException(
          'Material is referenced in one or more recipes and cannot be deleted',
        );
      }
      throw err;
    }
  }

  /**
   * Replaces the craft recipe of a material with the given ingredient rows
   * (delete-and-recreate, same pattern as part recipes).
   */
  private async replaceRecipe(
    em: EntityManager,
    materialId: string,
    ingredients: Array<{ ingredientMaterialId: string; quantity: number }>,
  ): Promise<void> {
    await em.delete(MaterialIngredient, { materialId });
    if (!ingredients.length) return;

    await em.insert(
      MaterialIngredient,
      ingredients.map((i) => ({
        materialId,
        ingredientMaterialId: i.ingredientMaterialId,
        quantity: i.quantity,
      })),
    );
  }

  private async assertIngredientsValid(
    ingredients:
      | Array<{ ingredientMaterialId: string; quantity: number }>
      | undefined,
    selfId: string | null,
  ): Promise<void> {
    if (!ingredients?.length) return;

    const ids = ingredients.map((i) => i.ingredientMaterialId);
    if (selfId && ids.includes(selfId)) {
      throw new BadRequestException('A material cannot be crafted from itself');
    }
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'Duplicate craft ingredients are not allowed',
      );
    }

    const found = await this.repo.find({ where: { id: In(ids) } });
    const foundIds = new Set(found.map((m) => m.id));
    const missing = ids.filter((x) => !foundIds.has(x));
    if (missing.length) {
      throw new BadRequestException(
        `Unknown ingredient material(s): ${missing.join(', ')}`,
      );
    }
  }
}
