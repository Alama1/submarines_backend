import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PartSet } from './part-set.entity';
import { SubmarinePart } from './submarine-part.entity';

@Entity('part_set_items')
export class PartSetItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => PartSet, (set) => set.items, { onDelete: 'CASCADE' })
  set: PartSet;

  @ManyToOne(() => SubmarinePart, { nullable: true, eager: true, onDelete: 'SET NULL' })
  part: SubmarinePart | null;

  @Column()
  partName: string;

  @Column({ type: 'int' })
  quantity: number;
}
