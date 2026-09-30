import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StoredBag } from './inventory-cache.types';

/**
 * Server-side cache of one character's inventory.
 *
 * One row per character (keyed by name+world) so reports from any device or
 * retainer session merge instead of overwrite: switching characters or
 * machines never loses previously reported inventories.
 */
@Entity('character_inventories')
export class CharacterInventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Stable identifier: lowercase "name@world". */
  @Column({ unique: true })
  characterKey: string;

  /** Character name exactly as reported (display form). */
  @Column()
  characterName: string;

  @Column({ type: 'varchar', nullable: true })
  homeWorld: string | null;

  @Column({ type: 'jsonb', default: '[]' })
  bags: StoredBag[];

  /** Timestamp of the report this row was last built from. */
  @Column({ type: 'timestamptz' })
  lastReportedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
