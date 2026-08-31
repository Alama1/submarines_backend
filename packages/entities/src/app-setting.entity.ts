import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Simple key/value store for runtime-editable application settings */
@Entity('app_settings')
export class AppSetting {
  @PrimaryColumn({ type: 'varchar' })
  key: string;

  @Column({ type: 'text', nullable: true })
  value: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
