import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
} from 'typeorm';

@Entity('api_keys')
export class ApiKey {
  @PrimaryColumn()
  keyHash: string;

  @Column({ type: 'text', nullable: true })
  label: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  @Column({ default: true })
  isActive: boolean;
}

