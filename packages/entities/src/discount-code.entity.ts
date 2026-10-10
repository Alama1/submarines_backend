import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type DiscountCodeType = 'flat' | 'percent';

@Entity('discount_codes')
export class DiscountCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 40 })
  code: string;

  @Column({ type: 'varchar', length: 10 })
  discountType: DiscountCodeType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  discountValue: number;

  @Column({ type: 'int' })
  maxUses: number;

  @Column({ type: 'int', default: 0 })
  usedCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  activeFrom: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  activeUntil: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
