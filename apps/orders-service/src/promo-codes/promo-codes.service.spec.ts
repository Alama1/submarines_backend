import { PromoCodesService } from './promo-codes.service';
import { DiscountCode } from '@ff14/entities';

describe('PromoCodesService — normalizeCode', () => {
  const svc = new PromoCodesService({} as any, {} as any);

  it('trims and uppercases codes', () => {
    expect(svc.normalizeCode('  promo-10  ')).toBe('PROMO-10');
  });

  it('rejects codes that are too short or contain invalid characters', () => {
    expect(() => svc.normalizeCode('AB')).toThrow();
    expect(() => svc.normalizeCode('BAD CODE!')).toThrow();
    expect(() => svc.normalizeCode('')).toThrow();
  });

  it('accepts letters, numbers, dashes and underscores', () => {
    expect(svc.normalizeCode('SUMMER_2026-A1')).toBe('SUMMER_2026-A1');
  });
});

describe('PromoCodesService — resolveStatus', () => {
  const svc = new PromoCodesService({} as any, {} as any);

  const code = (over: Partial<DiscountCode> = {}): DiscountCode =>
    ({
      activeFrom: null,
      activeUntil: null,
      usedCount: 0,
      maxUses: 5,
      ...over,
    }) as DiscountCode;

  it('is active when no window is set and uses remain', () => {
    expect(svc.resolveStatus(code())).toBe('active');
  });

  it('is not started before activeFrom', () => {
    const dc = code({ activeFrom: new Date(Date.now() + 60_000) });
    expect(svc.resolveStatus(dc)).toBe('not_started');
  });

  it('is expired after activeUntil', () => {
    const dc = code({ activeUntil: new Date(Date.now() - 60_000) });
    expect(svc.resolveStatus(dc)).toBe('expired');
  });

  it('is exhausted when usedCount reached maxUses', () => {
    expect(svc.resolveStatus(code({ usedCount: 5, maxUses: 5 }))).toBe('exhausted');
  });
});

describe('PromoCodesService — computeDiscountAmount', () => {
  const svc = new PromoCodesService({} as any, {} as any);

  const code = (discountType: 'flat' | 'percent', discountValue: number): DiscountCode =>
    ({ discountType, discountValue }) as DiscountCode;

  it('computes rounded percentage amounts', () => {
    expect(svc.computeDiscountAmount(code('percent', 10), 12345)).toBe(1235);
    expect(svc.computeDiscountAmount(code('percent', 12.5), 1000)).toBe(125);
  });

  it('computes flat amounts capped at the subtotal', () => {
    expect(svc.computeDiscountAmount(code('flat', 5000), 10000)).toBe(5000);
    expect(svc.computeDiscountAmount(code('flat', 5000), 1000)).toBe(1000);
  });
});
