import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CraftClaimItem } from './craft-claim-item.entity';

export type CraftClaimStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

@Entity('craft_claims')
export class CraftClaim {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 24 })
  claimCode: string;

  /** Discord username of the crafter who took the claim. */
  @Column({ length: 60 })
  nickname: string;

  @Column({ default: 'pending' })
  status: CraftClaimStatus;

  @Column({ type: 'int' })
  subtotal: number;

  /** Bulk bonus percent snapshot taken at claim time. */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  bonusPct: number;

  @Column({ type: 'int', default: 0 })
  bonusAmount: number;

  /** subtotal + bonusAmount — the payout owed to the crafter. */
  @Column({ type: 'int' })
  total: number;

  @Column({ type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => CraftClaimItem, (item) => item.claim, { cascade: true, eager: true })
  items: CraftClaimItem[];
}
