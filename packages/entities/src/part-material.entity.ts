import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SubmarinePart } from './submarine-part.entity';
import { BaseMaterial } from './base-material.entity';

@Entity('part_materials')
export class PartMaterial {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SubmarinePart, (part) => part.materials, { onDelete: 'CASCADE' })
  part: SubmarinePart;

  @ManyToOne(() => BaseMaterial, (mat) => mat.partMaterials, { eager: true, onDelete: 'RESTRICT' })
  material: BaseMaterial;

  @Column({ type: 'int' })
  quantity: number;
}

