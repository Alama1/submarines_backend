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

  /** Short unique human-readable code shared with admin (e.g. SUB-7K9P-2M4X-8QRT) */
  @Column({ unique: true, length: 24 })
  orderCode: string;

  @Column()
  clientName: string;

  /** When true, the client's name is hidden from public endpoints and shown as "Anonymous" */
  @Column({ default: false })
  isAnonymous: boolean;

  /** Optional Discord tag or in-game character contact */
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

  /** ISO date string or human-readable delivery date */
  @Column({ type: 'text', nullable: true })
  fulfillmentDt: string | null;

  /** Timestamp when admin confirmed/activated the order with the code */
  @Column({ type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true, eager: true })
  items: OrderItem[];
}

