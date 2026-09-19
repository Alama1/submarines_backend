import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BaseMaterial } from './base-material.entity';

@Entity('material_ingredients')
export class MaterialIngredient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  materialId: string;

  @ManyToOne(() => BaseMaterial, (mat) => mat.recipe, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'material_id' })
  material: BaseMaterial;

  @Column({ type: 'uuid' })
  ingredientMaterialId: string;

  @ManyToOne(() => BaseMaterial, (mat) => mat.usedIn, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ingredient_material_id' })
  ingredient: BaseMaterial;

  @Column({ type: 'int' })
  quantity: number;
}
