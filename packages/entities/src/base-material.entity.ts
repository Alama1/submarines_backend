import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PartMaterial } from './part-material.entity';

@Entity('base_materials')
export class BaseMaterial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** In-game item name (unique) */
  @Column({ unique: true })
  name: string;

  /** Universalis / XIVAPI item ID — used for automatic price syncing */
  @Column({ type: 'int', nullable: true })
  itemId: number | null;

  /** Target quantity to keep in stock */
  @Column({ type: 'int', default: 0 })
  desiredQuantity: number;

  /** Current available count */
  @Column({ type: 'int', default: 0 })
  currentStock: number;

  /** Universalis market price */
  @Column({ type: 'int', nullable: true })
  marketPrice: number | null;

  /** Custom manual price override — takes priority over marketPrice */
  @Column({ type: 'int', nullable: true })
  myPrice: number | null;

  /** Vendor NPC buy price */
  @Column({ type: 'int', nullable: true })
  npcPrice: number | null;

  @Column({ default: 'Market' })
  whereToBuy: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => PartMaterial, (pm) => pm.material)
  partMaterials: PartMaterial[];
}

