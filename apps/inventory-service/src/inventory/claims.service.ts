import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { In, Repository } from 'typeorm';
import {
  BaseMaterial,
  CraftClaim,
  CraftClaimStatus,
  CrafterBulkDiscount,
} from '@ff14/entities';
import { CreateCraftClaimDto } from './dto/create-craft-claim.dto';
import { UpdateClaimStatusDto } from './dto/update-claim-status.dto';

@Injectable()
export class ClaimsService {
  private readonly logger = new Logger(ClaimsService.name);

  /** Only active claims reduce the "remaining" figure on the shopping list. */
  private static readonly COUNTED_STATUSES: CraftClaimStatus[] = [
    'confirmed',
    'completed',
  ];

  /** Statuses a crafter may still cancel themselves. */
  private static readonly USER_CANCELLABLE: CraftClaimStatus[] = [
    'pending',
    'confirmed',
  ];

  constructor(
    @InjectRepository(CraftClaim)
    private readonly claimRepo: Repository<CraftClaim>,
    @InjectRepository(BaseMaterial)
    private readonly materialRepo: Repository<BaseMaterial>,
    @InjectRepository(CrafterBulkDiscount)
    private readonly bonusRepo: Repository<CrafterBulkDiscount>,
  ) {}

  private async generateUniqueClaimCode(): Promise<string> {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excludes confusing characters 0/O, 1/I
    const group = (): string => {
      const bytes = crypto.randomBytes(4);
      let out = '';
      for (let i = 0; i < 4; i++) {
        out += chars[bytes[i] % chars.length];
      }
      return out;
    };

    for (let attempt = 0; attempt < 10; attempt++) {
      const code = `CLM-${group()}-${group()}-${group()}`;
      const existing = await this.claimRepo.findOne({ where: { claimCode: code } });
      if (!existing) {
        return code;
      }
    }
    return `CLM-${Date.now().toString(36).toUpperCase()}`;
  }

  private async resolveBonusPct(totalUnits: number): Promise<number> {
    const tiers = await this.bonusRepo.find();
    const matching = tiers
      .filter((t) => totalUnits >= t.threshold)
      .sort((a, b) => b.threshold - a.threshold)[0];
    return matching ? Number(matching.discountPercent) || 0 : 0;
  }

  /**
   * Creates a claim request: snapshot of prices and the bulk bonus tier at
   * claim time, so the payout shown to the crafter never shifts afterwards.
   */
  async create(dto: CreateCraftClaimDto): Promise<CraftClaim> {
    // Merge duplicate material entries into a single line each
    const quantities = new Map<string, number>();
    for (const item of dto.items) {
      quantities.set(item.materialId, (quantities.get(item.materialId) ?? 0) + item.quantity);
    }

    const materialIds = [...quantities.keys()];
    const materials = await this.materialRepo.find({ where: { id: In(materialIds) } });
    if (materials.length !== materialIds.length) {
      throw new BadRequestException('One or more selected materials do not exist');
    }
    const materialById = new Map(materials.map((m) => [m.id, m]));

    const priced = [...quantities.entries()].map(([materialId, quantity]) => {
      const mat = materialById.get(materialId)!;
      const unitPrice = mat.myPrice ?? mat.marketPrice ?? mat.npcPrice ?? 0;
      return {
        materialId,
        materialName: mat.name,
        quantity,
        unitPrice,
        lineTotal: unitPrice * quantity,
      };
    });

    const subtotal = priced.reduce((sum, p) => sum + p.lineTotal, 0);
    const totalUnits = priced.reduce((sum, p) => sum + p.quantity, 0);
    const bonusPct = await this.resolveBonusPct(totalUnits);
    const bonusAmount = Math.round(subtotal * (bonusPct / 100));

    return this.claimRepo.save(
      this.claimRepo.create({
        claimCode: await this.generateUniqueClaimCode(),
        nickname: dto.nickname.trim(),
        status: 'pending',
        subtotal,
        bonusPct,
        bonusAmount,
        total: subtotal + bonusAmount,
        items: priced,
      }),
    );
  }

  async findByCode(code: string): Promise<CraftClaim> {
    const claim = await this.claimRepo.findOne({
      where: { claimCode: code.trim().toUpperCase() },
    });
    if (!claim) throw new NotFoundException(`Claim "${code}" not found`);
    return claim;
  }

  async cancelByCode(code: string): Promise<CraftClaim> {
    const claim = await this.findByCode(code);
    if (!ClaimsService.USER_CANCELLABLE.includes(claim.status)) {
      throw new BadRequestException(
        claim.status === 'cancelled'
          ? 'This claim is already cancelled'
          : 'Completed claims can no longer be cancelled',
      );
    }
    claim.status = 'cancelled';
    return this.claimRepo.save(claim);
  }

  async completeByCode(code: string): Promise<CraftClaim> {
    const claim = await this.findByCode(code);
    if (claim.status !== 'confirmed') {
      throw new BadRequestException(
        'Only confirmed claims can be marked as completed — wait for the confirmation first',
      );
    }
    claim.status = 'completed';
    claim.completedAt = new Date();
    return this.claimRepo.save(claim);
  }

  async findAll(statuses?: CraftClaimStatus[]): Promise<{ items: CraftClaim[]; total: number }> {
    const qb = this.claimRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.items', 'items');
    if (statuses?.length) {
      qb.where('c.status IN (:...statuses)', { statuses });
    }
    const [items, total] = await qb
      .orderBy('c.createdAt', 'DESC')
      .addOrderBy('items.id', 'ASC')
      .getManyAndCount();
    return { items, total };
  }

  async confirmById(id: string): Promise<CraftClaim> {
    const claim = await this.claimRepo.findOne({ where: { id } });
    if (!claim) throw new NotFoundException(`Claim "${id}" not found`);
    if (claim.status !== 'pending') {
      throw new BadRequestException('Only pending claims can be confirmed');
    }
    claim.status = 'confirmed';
    claim.confirmedAt = new Date();
    return this.claimRepo.save(claim);
  }

  async updateStatus(id: string, dto: UpdateClaimStatusDto): Promise<CraftClaim> {
    const claim = await this.claimRepo.findOne({ where: { id } });
    if (!claim) throw new NotFoundException(`Claim "${id}" not found`);
    claim.status = dto.status;
    if (dto.status === 'confirmed') claim.confirmedAt = new Date();
    if (dto.status === 'completed') claim.completedAt = new Date();
    return this.claimRepo.save(claim);
  }

  /** Admin cancel — keeps the row so the code stays resolvable for the crafter. */
  async cancelByAdmin(id: string): Promise<CraftClaim> {
    const claim = await this.claimRepo.findOne({ where: { id } });
    if (!claim) throw new NotFoundException(`Claim "${id}" not found`);
    if (claim.status === 'cancelled') return claim;
    claim.status = 'cancelled';
    return this.claimRepo.save(claim);
  }
}
