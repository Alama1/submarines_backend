import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Per-crafter access code: claims made with it skip confirmation and adopt its name. */
@Entity('trusted_crafter_codes')
export class TrustedCrafterCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 24 })
  code: string;

  /** Discord nickname attached to the code — auto-filled client-side, authoritative on claims. */
  @Column({ length: 60 })
  name: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
