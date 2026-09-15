import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PartMaterial } from './part-material.entity';
import { MaterialCategory, MaterialSource } from './material-enums';

@Entity('base_materials')
export class BaseMaterial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'int', nullable: true })
  itemId: number | null;

  @Column({ type: 'int', default: 0 })
  desiredQuantity: number;

  @Column({ type: 'int', default: 0 })
  currentStock: number;

  @Column({ type: 'int', nullable: true })
  marketPrice: number | null;

  @Column({ type: 'int', nullable: true })
  myPrice: number | null;

  @Column({ type: 'int', nullable: true })
  npcPrice: number | null;

  @Column({
    type: 'enum',
    enum: MaterialSource,
    enumName: 'material_source',
    default: MaterialSource.MARKET,
  })
  whereToBuy: MaterialSource;

  @Column({
    type: 'enum',
    enum: MaterialCategory,
    enumName: 'material_category',
    default: MaterialCategory.CRAFTING,
  })
  category: MaterialCategory;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => PartMaterial, (pm) => pm.material)
  partMaterials: PartMaterial[];
}

