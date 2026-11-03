import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BaseMaterial, CraftClaim, CrafterBulkDiscount, TrustedCrafterCode } from '@ff14/entities';
import { ClaimsService } from './claims.service';

describe('ClaimsService', () => {
  let svc: ClaimsService;
  let claimRepo: {
    findOne: jest.Mock;
    exist: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let materialRepo: { find: jest.Mock };
  let bonusRepo: { find: jest.Mock };
  let trustedRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    exist: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };

  const material = (overrides: Partial<BaseMaterial> = {}) =>
    ({
      id: 'mat-1',
      name: 'Cobalt Ingot',
      myPrice: 300,
      marketPrice: 400,
      npcPrice: null,
      ...overrides,
    }) as BaseMaterial;

  beforeEach(async () => {
    claimRepo = {
      findOne: jest.fn(),
      exist: jest.fn().mockResolvedValue(false),
      find: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ ...x, id: x.id ?? 'claim-new' })),
      update: jest.fn().mockResolvedValue({ affected: 0 }),
      createQueryBuilder: jest.fn(),
    };
    materialRepo = { find: jest.fn() };
    bonusRepo = { find: jest.fn().mockResolvedValue([]) };
    trustedRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      exist: jest.fn().mockResolvedValue(false),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ ...x, id: 'tc-1' })),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClaimsService,
        { provide: getRepositoryToken(CraftClaim), useValue: claimRepo },
        { provide: getRepositoryToken(BaseMaterial), useValue: materialRepo },
        { provide: getRepositoryToken(CrafterBulkDiscount), useValue: bonusRepo },
        { provide: getRepositoryToken(TrustedCrafterCode), useValue: trustedRepo },
      ],
    }).compile();

    svc = module.get<ClaimsService>(ClaimsService);
  });

  describe('create', () => {
    it('snapshots prices, merges duplicates and stores the payout', async () => {
      materialRepo.find.mockResolvedValue([material()]);
      bonusRepo.find.mockResolvedValue([
        { threshold: 10, discountPercent: '5' },
        { threshold: 100, discountPercent: '10' },
      ]);

      await svc.create({
        nickname: '  Alice  ',
        items: [
          { materialId: 'mat-1', quantity: 50 },
          { materialId: 'mat-1', quantity: 60 },
        ],
      });

      const created = claimRepo.create.mock.calls[0][0];
      expect(created).toMatchObject({
        nickname: 'Alice',
        status: 'pending',
        // 110 units → the 100+ tier
        bonusPct: 10,
        subtotal: 33000,
        bonusAmount: 3300,
        total: 36300,
      });
      expect(created.items).toEqual([
        { materialId: 'mat-1', materialName: 'Cobalt Ingot', quantity: 110, unitPrice: 300, lineTotal: 33000 },
      ]);
      expect(created.claimCode).toMatch(/^CLM-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
    });

    it('falls back through myPrice -> marketPrice -> npcPrice -> 0', async () => {
      materialRepo.find.mockResolvedValue([
        material({ id: 'a', myPrice: null, marketPrice: 40, npcPrice: 7 }),
        material({ id: 'b', myPrice: null, marketPrice: null, npcPrice: 7 }),
        material({ id: 'c', myPrice: null, marketPrice: null, npcPrice: null }),
      ]);

      await svc.create({
        nickname: 'Alice',
        items: [
          { materialId: 'a', quantity: 1 },
          { materialId: 'b', quantity: 1 },
          { materialId: 'c', quantity: 1 },
        ],
      });

      const created = claimRepo.create.mock.calls[0][0];
      expect(created.subtotal).toBe(47); // 40 + 7 + 0
      expect(created.bonusPct).toBe(0);
      expect(created.total).toBe(47);
    });

    it('rejects unknown materials', async () => {
      materialRepo.find.mockResolvedValue([]);

      await expect(
        svc.create({ nickname: 'Alice', items: [{ materialId: 'ghost', quantity: 1 }] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('confirms a trusted claim under the name attached to the code', async () => {
      materialRepo.find.mockResolvedValue([material()]);
      trustedRepo.findOne.mockResolvedValue({ code: 'TRU-AAAA-BBBB', name: 'Max' });

      await svc.create({
        nickname: 'Alice',
        items: [{ materialId: 'mat-1', quantity: 1 }],
        accessCode: ' tru-aaaa-bbbb ',
      });

      expect(trustedRepo.findOne).toHaveBeenCalledWith({ where: { code: 'TRU-AAAA-BBBB' } });
      const created = claimRepo.create.mock.calls[0][0];
      expect(created.nickname).toBe('Max');
      expect(created.status).toBe('confirmed');
      expect(created.confirmedAt).toBeInstanceOf(Date);
    });

    it('leaves a claim pending when the access code is unknown', async () => {
      materialRepo.find.mockResolvedValue([material()]);

      await svc.create({
        nickname: 'Alice',
        items: [{ materialId: 'mat-1', quantity: 1 }],
        accessCode: 'TRU-WRONG-CODE',
      });

      const created = claimRepo.create.mock.calls[0][0];
      expect(created.status).toBe('pending');
      expect(created.nickname).toBe('Alice');
    });

    it('leaves a claim pending when no access code is sent', async () => {
      materialRepo.find.mockResolvedValue([material()]);

      await svc.create({
        nickname: 'Alice',
        items: [{ materialId: 'mat-1', quantity: 1 }],
      });

      expect(claimRepo.create.mock.calls[0][0].status).toBe('pending');
      expect(trustedRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('trusted crafter codes', () => {
    it('generates a TRU code attached to the crafter name', async () => {
      const row = await svc.createTrustedCode('  Max  ');

      expect(row.code).toMatch(/^TRU-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
      expect(trustedRepo.create.mock.calls[0][0]).toEqual({ code: row.code, name: 'Max' });
    });

    it('looks a code up case-insensitively and 404s on unknown codes', async () => {
      trustedRepo.findOne.mockResolvedValue({ code: 'TRU-AAAA-BBBB', name: 'Max' });
      await expect(svc.lookupTrustedName(' tru-aaaa-bbbb ')).resolves.toBe('Max');

      trustedRepo.findOne.mockResolvedValue(null);
      await expect(svc.lookupTrustedName('TRU-NOPE-NOPE')).rejects.toThrow(NotFoundException);
    });

    it('revokes a code and 404s when it is already gone', async () => {
      await svc.revokeTrustedCode('tc-1');
      expect(trustedRepo.delete).toHaveBeenCalledWith({ id: 'tc-1' });

      trustedRepo.delete.mockResolvedValue({ affected: 0 });
      await expect(svc.revokeTrustedCode('gone')).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelExpiredPending', () => {
    it('cancels only pending claims older than one hour', async () => {
      await svc.cancelExpiredPending();

      const [where, patch] = claimRepo.update.mock.calls[0];
      expect(patch).toEqual({ status: 'cancelled' });
      expect(where.status).toBe('pending');
      const cutoff = new Date(where.createdAt.value);
      expect(cutoff.getTime()).toBeLessThan(Date.now() - 59 * 60 * 1000);
    });
  });

  describe('cancelByCode', () => {
    it('cancels a pending claim', async () => {
      claimRepo.findOne.mockResolvedValue({ id: 'x', status: 'pending' });
      const result = await svc.cancelByCode('CLM-AAAA-BBBB-CCCC');
      expect(result.status).toBe('cancelled');
    });

    it('refuses to cancel a completed claim', async () => {
      claimRepo.findOne.mockResolvedValue({ id: 'x', status: 'completed' });
      await expect(svc.cancelByCode('CLM-AAAA-BBBB-CCCC')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFound for an unknown code', async () => {
      claimRepo.findOne.mockResolvedValue(null);
      await expect(svc.cancelByCode('CLM-XXXX-XXXX-XXXX')).rejects.toThrow(NotFoundException);
    });
  });

  describe('completeByCode', () => {
    it('completes a confirmed claim and stamps completedAt', async () => {
      claimRepo.findOne.mockResolvedValue({ id: 'x', status: 'confirmed' });
      const result = await svc.completeByCode('CLM-AAAA-BBBB-CCCC');
      expect(result.status).toBe('completed');
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('refuses to complete a pending claim', async () => {
      claimRepo.findOne.mockResolvedValue({ id: 'x', status: 'pending' });
      await expect(svc.completeByCode('CLM-AAAA-BBBB-CCCC')).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirmById', () => {
    it('confirms a pending claim', async () => {
      claimRepo.findOne.mockResolvedValue({ id: 'x', status: 'pending' });
      const result = await svc.confirmById('x');
      expect(result.status).toBe('confirmed');
      expect(result.confirmedAt).toBeInstanceOf(Date);
    });

    it('refuses to confirm a cancelled claim', async () => {
      claimRepo.findOne.mockResolvedValue({ id: 'x', status: 'cancelled' });
      await expect(svc.confirmById('x')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFound for an unknown id', async () => {
      claimRepo.findOne.mockResolvedValue(null);
      await expect(svc.confirmById('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('sets any status with the matching timestamps', async () => {
      claimRepo.findOne.mockResolvedValue({ id: 'x', status: 'confirmed' });
      const result = await svc.updateStatus('x', { status: 'completed' });
      expect(result.status).toBe('completed');
      expect(result.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('cancelByAdmin', () => {
    it('cancels and keeps the row resolvable', async () => {
      claimRepo.findOne.mockResolvedValue({ id: 'x', status: 'confirmed' });
      const result = await svc.cancelByAdmin('x');
      expect(result.status).toBe('cancelled');
    });

    it('is a no-op for already cancelled claims', async () => {
      const existing = { id: 'x', status: 'cancelled' };
      claimRepo.findOne.mockResolvedValue(existing);
      const result = await svc.cancelByAdmin('x');
      expect(result).toBe(existing);
      expect(claimRepo.save).not.toHaveBeenCalled();
    });
  });
});
