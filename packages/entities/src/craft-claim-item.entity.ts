import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseMaterial } from './base-material.entity';
import { CraftClaim } from './craft-claim.entity';

@Entity('craft_claim_items')
export class CraftClaimItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => CraftClaim, (claim) => claim.items, { onDelete: 'CASCADE' })
  claim: CraftClaim;

  @Column({ type: 'uuid', nullable: true })
  materialId: string | null;

  @ManyToOne(() => BaseMaterial, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'material_id' })
  material: BaseMaterial | null;

  /** Name snapshot — survives material deletion. */
  @Column()
  materialName: string;

  @Column({ type: 'int' })
  quantity: number;

  /** Effective price snapshot taken at claim time. */
  @Column({ type: 'int' })
  unitPrice: number;

  @Column({ type: 'int' })
  lineTotal: number;
}
