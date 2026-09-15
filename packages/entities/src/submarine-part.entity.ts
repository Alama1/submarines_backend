import {
  Column,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PartMaterial } from './part-material.entity';

@Entity('submarine_parts')
export class SubmarinePart {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column({ type: 'int', nullable: true })
  itemId: number | null;

  @Column()
  partType: string;

  @Column()
  className: string;

  @Column()
  classKey: string;

  @Column({ default: false })
  isModified: boolean;

  @Column({ type: 'int' })
  price: number;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ type: 'int', default: 0 })
  desiredStock: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => PartMaterial, (pm) => pm.part, { cascade: true, eager: true })
  materials: PartMaterial[];
}

