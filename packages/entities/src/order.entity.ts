import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrderItem } from './order-item.entity';

export type OrderStatus = 'pending' | 'confirmed' | 'in_progress' | 'finished' | 'fulfilled' | 'cancelled';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 24 })
  orderCode: string;

  @Column()
  clientName: string;

  @Column({ default: false })
  isAnonymous: boolean;

  @Column({ type: 'text', nullable: true })
  contactInfo: string | null;

  @Column({ type: 'text', nullable: true })
  rawText: string | null;

  @Column({ type: 'int' })
  subtotal: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  discountPct: number;

  @Column({ type: 'int', default: 0 })
  discountAmt: number;

  @Column({ type: 'int' })
  total: number;

  @Column({ default: 'pending' })
  status: OrderStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'text', nullable: true })
  fulfillmentDt: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true, eager: true })
  items: OrderItem[];
}

