import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PartSetItem } from './part-set-item.entity';

/**
 * A named, persistent bundle of submarine parts (e.g. "Full Shark Set")
 * used as a profitability indicator in price management.
 */
@Entity('part_sets')
export class PartSet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => PartSetItem, (item) => item.set, { cascade: true, eager: true })
  items: PartSetItem[];
}
