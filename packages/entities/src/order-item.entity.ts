import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Order } from './order.entity';
import { SubmarinePart } from './submarine-part.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  order: Order;

  /**
   * Direct FK to SubmarinePart (SET NULL if part is deleted).
   * Allows navigating to the live, current part from an order.
   */
  @ManyToOne(() => SubmarinePart, { nullable: true, eager: true, onDelete: 'SET NULL' })
  part: SubmarinePart | null;

  /**
   * Snapshot fields — preserved permanently even if the part is renamed or repriced.
   * These protect historical receipt accuracy and accounting totals.
   */
  @Column()
  partName: string;

  @Column({ type: 'text', nullable: true })
  partType: string | null;

  @Column({ type: 'int' })
  quantity: number;

  /** Price captured at the moment the order was created */
  @Column({ type: 'int' })
  unitPrice: number;

  @Column({ type: 'int' })
  lineTotal: number;

  /** The submarine build this part was ordered for, e.g. "Shark + Whale" */
  @Column({ type: 'text', nullable: true })
  buildName: string | null;
}

