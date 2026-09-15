import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BaseMaterial } from './base-material.entity';

@Entity('material_claims')
export class MaterialClaim {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  materialId: string;

  @ManyToOne(() => BaseMaterial, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'material_id' })
  material: BaseMaterial;

  @Column({ type: 'varchar' })
  claimedFor: string;

  @Column({ type: 'int' })
  quantity: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
