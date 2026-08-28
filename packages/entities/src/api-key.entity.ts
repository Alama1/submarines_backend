import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
} from 'typeorm';

@Entity('api_keys')
export class ApiKey {
  /** SHA-256 hex digest — the raw key is never stored */
  @PrimaryColumn()
  keyHash: string;

  /** Human-readable label, e.g. "Firefox Extension — Home PC" */
  @Column({ type: 'text', nullable: true })
  label: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  @Column({ default: true })
  isActive: boolean;
}

