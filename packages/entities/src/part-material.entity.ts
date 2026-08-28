import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SubmarinePart } from './submarine-part.entity';
import { BaseMaterial } from './base-material.entity';

/**
 * Join entity between SubmarinePart and BaseMaterial.
 * Records how many units of a base material are required to craft one part.
 */
@Entity('part_materials')
export class PartMaterial {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SubmarinePart, (part) => part.materials, { onDelete: 'CASCADE' })
  part: SubmarinePart;

  /** RESTRICT: deleting a material that is still used in a recipe is blocked. */
  @ManyToOne(() => BaseMaterial, (mat) => mat.partMaterials, { eager: true, onDelete: 'RESTRICT' })
  material: BaseMaterial;

  /** Units of this material needed to craft 1 part */
  @Column({ type: 'int' })
  quantity: number;
}

