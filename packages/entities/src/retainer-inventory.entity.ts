import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StoredBag } from './inventory-cache.types';

/**
 * Server-side cache of one retainer's inventory.
 *
 * One row per retainer (keyed by the game's retainer id) so any device can
 * refresh it, and reports from devices with stale local caches never
 * overwrite fresher data (guarded by lastReportedAt).
 */
@Entity('retainer_inventories')
export class RetainerInventory {
  /** Game retainer id (u64). TypeORM surfaces postgres bigint as string. */
  @PrimaryColumn({ type: 'bigint' })
  retainerId: string;

  @Column()
  retainerName: string;

  /** characterKey of the owning character, when known. */
  @Column({ type: 'varchar', nullable: true })
  ownerKey: string | null;

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
