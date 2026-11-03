import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import {
  AppSetting,
  BaseMaterial,
  CraftClaim,
  CraftClaimStatus,
  CrafterBulkDiscount,
  effectivePriceOf,
  generateReadableCode,
} from '@ff14/entities';
import { CreateCraftClaimDto } from './dto/create-craft-claim.dto';
import { UpdateClaimStatusDto } from './dto/update-claim-status.dto';

@Injectable()
export class ClaimsService {
  private readonly logger = new Logger(ClaimsService.name);

  /** Statuses a crafter may still cancel themselves. */
  private static readonly USER_CANCELLABLE: CraftClaimStatus[] = [
    'pending',
    'confirmed',
  ];

  static readonly TRUSTED_CODE_KEY = 'trusted_crafter_code';

  /** A pending claim holds its materials for this long before auto-cancelling. */
  private static readonly PENDING_TTL_MS = 60 * 60 * 1000;

  constructor(
    @InjectRepository(CraftClaim)
    private readonly claimRepo: Repository<CraftClaim>,
    @InjectRepository(BaseMaterial)
    private readonly materialRepo: Repository<BaseMaterial>,
    @InjectRepository(CrafterBulkDiscount)
    private readonly bonusRepo: Repository<CrafterBulkDiscount>,
    @InjectRepository(AppSetting)
    private readonly settingRepo: Repository<AppSetting>,
  ) {}

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
      const unitPrice = effectivePriceOf(mat);
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

    // Trusted crafters (access code from the admin panel) skip confirmation —
    // their claims are born confirmed, so the pending-TTL cron never touches them.
    const trusted = await this.isTrustedAccessCode(dto.accessCode);

    return this.claimRepo.save(
      this.claimRepo.create({
        claimCode: await generateReadableCode('CLM', 3, (code) =>
          this.claimRepo.exist({ where: { claimCode: code } }),
        ),
        nickname: dto.nickname.trim(),
        status: trusted ? 'confirmed' : 'pending',
        confirmedAt: trusted ? new Date() : null,
        subtotal,
        bonusPct,
        bonusAmount,
        total: subtotal + bonusAmount,
        items: priced,
      }),
    );
  }

  async getTrustedCode(): Promise<string | null> {
    const row = await this.settingRepo.findOne({
      where: { key: ClaimsService.TRUSTED_CODE_KEY },
    });
    return row?.value ?? null;
  }

  private async isTrustedAccessCode(accessCode?: string): Promise<boolean> {
    if (!accessCode?.trim()) return false;
    const current = await this.getTrustedCode();
    return !!current && accessCode.trim().toUpperCase() === current.toUpperCase();
  }

  /** Rotates the single shared trusted-crafter code; old codes stop working. */
  async rotateTrustedCode(): Promise<string> {
    const code = await generateReadableCode('TRU', 2, async () => false);
    await this.settingRepo.upsert(
      { key: ClaimsService.TRUSTED_CODE_KEY, value: code },
      ['key'],
    );
    return code;
  }

  /**
   * Pending claims reserve materials for one hour; after that they are
   * cancelled here (every 5 min, so a claim may linger reserved for up to
   * ~5 extra minutes). shortcut: 5-min granularity, upgrade to per-claim
   * timers only if crafters complain about the grace window.
   */
  @Cron('0 */5 * * * *')
  async cancelExpiredPending(): Promise<void> {
    const cutoff = new Date(Date.now() - ClaimsService.PENDING_TTL_MS);
    const { affected } = await this.claimRepo.update(
      { status: 'pending', createdAt: LessThan(cutoff) },
      { status: 'cancelled' },
    );
    if (affected) {
      this.logger.log(`Auto-cancelled ${affected} expired pending claim(s)`);
    }
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
