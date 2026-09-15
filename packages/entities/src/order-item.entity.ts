import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Order } from './order.entity';
import { SubmarinePart } from './submarine-part.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  order: Order;

  @ManyToOne(() => SubmarinePart, { nullable: true, eager: true, onDelete: 'SET NULL' })
  part: SubmarinePart | null;

  @Column()
  partName: string;

  @Column({ type: 'text', nullable: true })
  partType: string | null;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'int' })
  unitPrice: number;

  @Column({ type: 'int' })
  lineTotal: number;

  @Column({ type: 'text', nullable: true })
  buildName: string | null;
}

