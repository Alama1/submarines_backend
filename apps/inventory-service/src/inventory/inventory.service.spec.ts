import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BaseMaterial, MaterialClaim, SubmarinePart } from '@ff14/entities';
import { InventoryService } from './inventory.service';

describe('InventoryService — claims', () => {
  let svc: InventoryService;
  let matRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    createQueryBuilder: jest.Mock;
    save: jest.Mock;
  };
  let claimRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };

  const material = {
    id: 'mat-1',
    name: 'Cobalt Ingot',
    itemId: 5059,
    currentStock: 0,
    desiredQuantity: 10000,
    whereToBuy: 'Market',
    category: 'crafting',
    updatedAt: new Date(),
  } as BaseMaterial;

  const claim = (id: string, quantity: number, claimedFor: string) =>
    ({
      id,
      materialId: 'mat-1',
      claimedFor,
      quantity,
      createdAt: new Date(),
    }) as MaterialClaim;

  beforeEach(async () => {
    matRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
      save: jest.fn(),
    };
    claimRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ ...x, id: 'claim-new' })),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: getRepositoryToken(BaseMaterial), useValue: matRepo },
        { provide: getRepositoryToken(MaterialClaim), useValue: claimRepo },
        { provide: CACHE_MANAGER, useValue: { reset: jest.fn() } },
        { provide: 'INVENTORY_RMQ_CLIENT', useValue: { emit: jest.fn() } },
      ],
    }).compile();

    svc = module.get<InventoryService>(InventoryService);
  });

  describe('findMissing', () => {
    const makeQb = (result: [unknown[], number]) => ({
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue(result),
    });

    it('aggregates claimed amounts and computes the unclaimed remainder', async () => {
      const qb = makeQb([[material], 1]);
      matRepo.createQueryBuilder.mockReturnValue(qb);
      claimRepo.find.mockResolvedValue([
        claim('c1', 3000, 'Alice'),
        claim('c2', 2000, 'Bob'),
      ]);

      const result = await svc.findMissing(undefined, 1, 50);

      expect(result.total).toBe(1);
      expect(result.items[0]).toMatchObject({
        name: 'Cobalt Ingot',
        deficit: 10000,
        claimed: 5000,
        remaining: 5000,
      });
      expect(result.items[0].claims).toHaveLength(2);
    });

    it('never reports a negative remainder when claims exceed the deficit', async () => {
      const qb = makeQb([[material], 1]);
      matRepo.createQueryBuilder.mockReturnValue(qb);
      claimRepo.find.mockResolvedValue([claim('c1', 12000, 'Alice')]);

      const result = await svc.findMissing(undefined, 1, 50);

      expect(result.items[0].claimed).toBe(12000);
      expect(result.items[0].remaining).toBe(0);
    });

    it('applies the search filter to the missing-materials query', async () => {
      const qb = makeQb([[], 0]);
      matRepo.createQueryBuilder.mockReturnValue(qb);
      claimRepo.find.mockResolvedValue([]);

      await svc.findMissing('cobalt', 1, 50);

      expect(qb.andWhere).toHaveBeenCalledWith('LOWER(m.name) LIKE :search', {
        search: '%cobalt%',
      });
    });

    it('excludes submarine part rows from the missing-materials list', async () => {
      const qb = makeQb([[], 0]);
      matRepo.createQueryBuilder.mockReturnValue(qb);
      claimRepo.find.mockResolvedValue([]);

      await svc.findMissing(undefined, 1, 50);

      expect(qb.leftJoin).toHaveBeenCalledWith(
        SubmarinePart,
        'p',
        'LOWER(p.name) = LOWER(m.name)',
      );
      expect(qb.andWhere).toHaveBeenCalledWith('p.id IS NULL');
    });
  });

  describe('createClaim', () => {
    it('creates a claim for an existing material and returns the summary', async () => {
      matRepo.findOne.mockResolvedValue(material);

      const result = await svc.createClaim('mat-1', {
        claimedFor: '  Alice  ',
        quantity: 2500,
      });

      expect(claimRepo.create).toHaveBeenCalledWith({
        materialId: 'mat-1',
        claimedFor: 'Alice',
        quantity: 2500,
      });
      expect(result).toMatchObject({
        id: 'claim-new',
        materialId: 'mat-1',
        claimedFor: 'Alice',
        quantity: 2500,
      });
    });

    it('throws NotFound for an unknown material', async () => {
      matRepo.findOne.mockResolvedValue(null);

      await expect(
        svc.createClaim('missing-id', { claimedFor: 'Alice', quantity: 1 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteClaim', () => {
    it('removes an existing claim', async () => {
      claimRepo.findOne.mockResolvedValue(claim('c1', 100, 'Alice'));

      await expect(svc.deleteClaim('c1')).resolves.toBeUndefined();
      expect(claimRepo.remove).toHaveBeenCalled();
    });

    it('throws NotFound for an unknown claim', async () => {
      claimRepo.findOne.mockResolvedValue(null);

      await expect(svc.deleteClaim('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findClaims', () => {
    it('returns the deficit summary with all claims', async () => {
      matRepo.findOne.mockResolvedValue(material);
      claimRepo.find.mockResolvedValue([
        claim('c1', 3000, 'Alice'),
        claim('c2', 2000, 'Bob'),
      ]);

      const result = await svc.findClaims('mat-1');

      expect(result).toMatchObject({
        deficit: 10000,
        totalClaimed: 5000,
        remaining: 5000,
      });
      expect(result.claims).toHaveLength(2);
      expect(result.material.name).toBe('Cobalt Ingot');
    });

    it('throws NotFound for an unknown material', async () => {
      matRepo.findOne.mockResolvedValue(null);

      await expect(svc.findClaims('missing-id')).rejects.toThrow(NotFoundException);
    });
  });
});
