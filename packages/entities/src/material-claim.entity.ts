import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BaseMaterial } from './base-material.entity';

/** A person's pledge to deliver a quantity of a material that is currently missing */
@Entity('material_claims')
export class MaterialClaim {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  materialId: string;

  @ManyToOne(() => BaseMaterial, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'material_id' })
  material: BaseMaterial;

  /** Name of the person who claimed the material */
  @Column({ type: 'varchar' })
  claimedFor: string;

  /** Amount the person committed to deliver */
  @Column({ type: 'int' })
  quantity: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
