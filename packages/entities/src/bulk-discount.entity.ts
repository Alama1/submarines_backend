import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('bulk_discounts')
export class BulkDiscount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Minimum total parts quantity in order to qualify */
  @Column({ type: 'int' })
  threshold: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  discountPercent: number;
}

