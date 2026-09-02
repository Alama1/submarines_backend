import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PartSet } from './part-set.entity';
import { SubmarinePart } from './submarine-part.entity';

/**
 * A submarine part included in a part set, with the amount of times it
 * appears in the set (a full set usually has one hull/stern/bow/bridge).
 */
@Entity('part_set_items')
export class PartSetItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => PartSet, (set) => set.items, { onDelete: 'CASCADE' })
  set: PartSet;

  /** SET NULL: a deleted part keeps its row (with zeros) instead of breaking the set */
  @ManyToOne(() => SubmarinePart, { nullable: true, eager: true, onDelete: 'SET NULL' })
  part: SubmarinePart | null;

  /** Snapshot of the part name — display survives part deletion */
  @Column()
  partName: string;

  @Column({ type: 'int' })
  quantity: number;
}
