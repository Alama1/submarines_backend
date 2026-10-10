import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { DiscountCode, DiscountCodeType } from '@ff14/entities';
import { PromoCodeRejectionReason } from '@ff14/types';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { UpdatePromoCodeDto } from './dto/update-promo-code.dto';

export interface PromoCodeValidation {
  valid: boolean;
  reason?: PromoCodeRejectionReason;
  message?: string;
  discountAmt?: number;
}

const REJECTION_MESSAGES: Record<PromoCodeRejectionReason, string> = {
  not_found: 'Promo code not found',
  not_started: 'This promo code is not active yet',
  expired: 'This promo code has expired',
  exhausted: 'This promo code has reached its usage limit',
};

@Injectable()
export class PromoCodesService {
  constructor(
    @InjectRepository(DiscountCode)
    private readonly repo: Repository<DiscountCode>,
    private readonly ds: DataSource,
  ) {}

  normalizeCode(raw: string): string {
    const normalized = (raw ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,40}$/.test(normalized)) {
      throw new BadRequestException(
        'Promo code must be 3-40 characters (letters, numbers, dashes or underscores)',
      );
    }
    return normalized;
  }

  private generateCodeValue(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excludes confusing characters 0/O, 1/I
    const group = (): string => {
      const bytes = crypto.randomBytes(4);
      let out = '';
      for (let i = 0; i < 4; i++) {
        out += chars[bytes[i] % chars.length];
      }
      return out;
    };
    return `PROMO-${group()}-${group()}`;
  }

  /** Status of a code at a point in time. Assumes the entity exists. */
  resolveStatus(
    dc: Pick<DiscountCode, 'activeFrom' | 'activeUntil' | 'usedCount' | 'maxUses'>,
    now = new Date(),
  ): 'active' | PromoCodeRejectionReason {
    if (dc.activeFrom && now < new Date(dc.activeFrom)) return 'not_started';
    if (dc.activeUntil && now > new Date(dc.activeUntil)) return 'expired';
    if (dc.usedCount >= dc.maxUses) return 'exhausted';
    return 'active';
  }

  computeDiscountAmount(dc: Pick<DiscountCode, 'discountType' | 'discountValue'>, subtotal: number): number {
    const value = Number(dc.discountValue) || 0;
    if (dc.discountType === 'percent') {
      return Math.round(subtotal * (value / 100));
    }
    return Math.max(0, Math.min(Math.round(value), subtotal));
  }

  /** Non-throwing validation used by the public endpoint. */
  async validate(rawCode: string, subtotal?: number): Promise<PromoCodeValidation & { code?: DiscountCode }> {
    let normalized: string;
    try {
      normalized = this.normalizeCode(rawCode);
    } catch {
      return { valid: false, reason: 'not_found', message: 'Invalid promo code format' };
    }

    const dc = await this.repo.findOne({ where: { code: normalized } });
    if (!dc) {
      return { valid: false, reason: 'not_found', message: REJECTION_MESSAGES.not_found };
    }

    const status = this.resolveStatus(dc);
    if (status !== 'active') {
      return { valid: false, reason: status, message: REJECTION_MESSAGES[status] };
    }

    const discountAmt =
      subtotal !== undefined ? this.computeDiscountAmount(dc, subtotal) : undefined;

    return { valid: true, code: dc, discountAmt };
  }

  /** Throwing validation used when placing/patching orders. */
  async assertUsable(rawCode: string): Promise<DiscountCode> {
    const normalized = this.normalizeCode(rawCode);
    const dc = await this.repo.findOne({ where: { code: normalized } });
    if (!dc) {
      throw new BadRequestException(`Promo code "${normalized}" not found`);
    }
    const status = this.resolveStatus(dc);
    if (status !== 'active') {
      throw new BadRequestException(REJECTION_MESSAGES[status]);
    }
    return dc;
  }

  /**
   * Atomically consumes one use of the code. Must be called inside the order
   * transaction — throws (and rolls back) when the last use was taken meanwhile.
   */
  async consumeTx(em: EntityManager, promoCodeId: string): Promise<void> {
    const rows: unknown[] = await em.query(
      `UPDATE discount_codes
       SET used_count = used_count + 1, updated_at = now()
       WHERE id = $1 AND used_count < max_uses
       RETURNING used_count`,
      [promoCodeId],
    );
    if (!rows.length) {
      throw new ConflictException('This promo code has just reached its usage limit');
    }
  }

  /** Releases one use of the code (order cancellation / promo removal). */
  async releaseTx(em: EntityManager, promoCodeId: string): Promise<void> {
    await em.query(
      `UPDATE discount_codes
       SET used_count = GREATEST(used_count - 1, 0), updated_at = now()
       WHERE id = $1`,
      [promoCodeId],
    );
  }

  findAll(): Promise<DiscountCode[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<DiscountCode> {
    const dc = await this.repo.findOne({ where: { id } });
    if (!dc) throw new NotFoundException(`Promo code "${id}" not found`);
    return dc;
  }

  /** Loads a code without throwing — used for repricing existing orders. */
  async findByIdOrNull(id: string): Promise<DiscountCode | null> {
    return this.repo.findOne({ where: { id } });
  }

  async create(dto: CreatePromoCodeDto): Promise<DiscountCode> {
    const code = dto.code ? this.normalizeCode(dto.code) : await this.generateUniqueCode();
    this.assertValueInRange(dto.discountType, dto.discountValue);
    this.assertWindow(dto.activeFrom ?? null, dto.activeUntil ?? null);

    const existing = await this.repo.findOne({ where: { code } });
    if (existing) {
      throw new ConflictException(`Promo code "${code}" already exists`);
    }

    return this.repo.save(
      this.repo.create({
        code,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxUses: dto.maxUses,
        activeFrom: dto.activeFrom ? new Date(dto.activeFrom) : null,
        activeUntil: dto.activeUntil ? new Date(dto.activeUntil) : null,
        usedCount: 0,
      }),
    );
  }

  async update(id: string, dto: UpdatePromoCodeDto): Promise<DiscountCode> {
    const dc = await this.findOne(id);

    if (dto.code !== undefined) {
      const code = this.normalizeCode(dto.code);
      if (code !== dc.code) {
        const existing = await this.repo.findOne({ where: { code } });
        if (existing) {
          throw new ConflictException(`Promo code "${code}" already exists`);
        }
        dc.code = code;
      }
    }
    if (dto.discountType !== undefined) dc.discountType = dto.discountType;
    if (dto.discountValue !== undefined) {
      this.assertValueInRange(dc.discountType, dto.discountValue);
      dc.discountValue = dto.discountValue;
    }
    if (dto.discountType !== undefined && dto.discountValue === undefined) {
      this.assertValueInRange(dc.discountType, Number(dc.discountValue));
    }
    if (dto.maxUses !== undefined) {
      if (dto.maxUses < dc.usedCount) {
        throw new BadRequestException(
          `Max uses cannot be lower than the ${dc.usedCount} uses already recorded`,
        );
      }
      dc.maxUses = dto.maxUses;
    }
    if (dto.activeFrom !== undefined || dto.activeUntil !== undefined) {
      const from = dto.activeFrom !== undefined ? (dto.activeFrom ? new Date(dto.activeFrom) : null) : dc.activeFrom;
      const until = dto.activeUntil !== undefined ? (dto.activeUntil ? new Date(dto.activeUntil) : null) : dc.activeUntil;
      this.assertWindow(from, until);
      dc.activeFrom = from;
      dc.activeUntil = until;
    }

    await this.repo.save(dc);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const dc = await this.findOne(id);
    await this.repo.remove(dc);
  }

  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = this.generateCodeValue();
      const existing = await this.repo.findOne({ where: { code } });
      if (!existing) return code;
    }
    return `PROMO-${Date.now().toString(36).toUpperCase()}`;
  }

  private assertValueInRange(type: DiscountCodeType, value: number): void {
    if (type === 'percent' && value > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100%');
    }
  }

  private assertWindow(activeFrom: Date | string | null, activeUntil: Date | string | null): void {
    if (activeFrom && activeUntil && new Date(activeFrom) >= new Date(activeUntil)) {
      throw new BadRequestException('Promo code activation start must be before its end');
    }
  }
}
