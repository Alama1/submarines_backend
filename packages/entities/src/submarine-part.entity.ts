import {
  Column,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PartMaterial } from './part-material.entity';

@Entity('submarine_parts')
export class SubmarinePart {
  /** Stable slug identifier — e.g. 'shark_hull', 'whale_modified_stern' */
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  /** FF14 item ID — used to match crafted parts in the inventory plugin payload */
  @Column({ type: 'int', nullable: true })
  itemId: number | null;

  /** hull | stern | bow | bridge */
  @Column()
  partType: string;

  @Column()
  className: string;

  @Column()
  classKey: string;

  /** True for the mk2 (modified) version of the part */
  @Column({ default: false })
  isModified: boolean;

  /** Gil sale price for one crafted part */
  @Column({ type: 'int' })
  price: number;

  /** Completed, ready-to-sell units in stock */
  @Column({ type: 'int', default: 0 })
  stock: number;

  /** Target quantity of this part desired in workshop inventory */
  @Column({ type: 'int', default: 0 })
  desiredStock: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => PartMaterial, (pm) => pm.part, { cascade: true, eager: true })
  materials: PartMaterial[];
}

