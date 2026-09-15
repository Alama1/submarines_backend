import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('app_settings')
export class AppSetting {
  @PrimaryColumn({ type: 'varchar' })
  key: string;

  @Column({ type: 'text', nullable: true })
  value: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
