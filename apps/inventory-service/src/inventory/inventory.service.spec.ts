import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BaseMaterial,
  CharacterInventory,
  MaterialClaim,
  RetainerInventory,
  SubmarinePart,
} from '@ff14/entities';
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
  let charInvRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };
  let retainerInvRepo: {
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
    process.env.INTERNAL_TOKEN = 'test-internal-token';

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
    charInvRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ ...x, id: 'char-inv-new' })),
      remove: jest.fn(),
    };
    retainerInvRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: getRepositoryToken(BaseMaterial), useValue: matRepo },
        { provide: getRepositoryToken(MaterialClaim), useValue: claimRepo },
        { provide: getRepositoryToken(CharacterInventory), useValue: charInvRepo },
        { provide: getRepositoryToken(RetainerInventory), useValue: retainerInvRepo },
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

    it('excludes materials with a zero desired quantity', async () => {
      const qb = makeQb([[], 0]);
      matRepo.createQueryBuilder.mockReturnValue(qb);
      claimRepo.find.mockResolvedValue([]);

      await svc.findMissing(undefined, 1, 50);

      expect(qb.andWhere).toHaveBeenCalledWith('m.desiredQuantity > 0');
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

  describe('ingest', () => {
    const rmqEmit = () =>
      (svc as unknown as { rmqClient: { emit: jest.Mock } }).rmqClient.emit;

    it('caches the character inventory and each retainer, then emits recompute', async () => {
      charInvRepo.findOne.mockResolvedValue(null);
      retainerInvRepo.findOne.mockResolvedValue(null);

      const result = await svc.ingest({
        characterName: 'Foo Bar',
        homeWorld: 'Cerberus',
        timestamp: '2026-09-30T10:00:00.000Z',
        playerInventory: [{ bagName: 'Inventory1', items: [] }],
        retainers: [
          {
            retainerName: 'Bags',
            retainerId: '12345678901234567',
            lastUpdated: '2026-09-30T09:00:00.000Z',
            bags: [],
          },
        ],
      });

      expect(result).toMatchObject({
        status: 'accepted',
        source: 'Foo Bar',
        characterCached: true,
        retainersCached: 1,
        staleSkipped: 0,
      });
      expect(charInvRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          characterKey: 'foo bar@cerberus',
          characterName: 'Foo Bar',
        }),
      );
      expect(retainerInvRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          retainerId: '12345678901234567',
          ownerKey: 'foo bar@cerberus',
        }),
      );
      expect(rmqEmit()).toHaveBeenCalledTimes(1);
    });

    it('skips a character report older than the cached one', async () => {
      charInvRepo.findOne.mockResolvedValue({
        characterKey: 'foo bar@cerberus',
        lastReportedAt: new Date('2026-09-30T12:00:00.000Z'),
      });
      retainerInvRepo.findOne.mockResolvedValue(null);

      const result = await svc.ingest({
        characterName: 'Foo Bar',
        homeWorld: 'Cerberus',
        timestamp: '2026-09-30T10:00:00.000Z',
        playerInventory: [],
      });

      expect(result).toMatchObject({ characterCached: false, staleSkipped: 1 });
      expect(charInvRepo.save).not.toHaveBeenCalled();
    });

    it('skips stale retainer data so old device caches never regress fresher data', async () => {
      charInvRepo.findOne.mockResolvedValue(null);
      retainerInvRepo.findOne.mockResolvedValue({
        retainerId: '12345678901234567',
        lastReportedAt: new Date('2026-09-30T12:00:00.000Z'),
      });

      const result = await svc.ingest({
        characterName: 'Foo Bar',
        homeWorld: 'Cerberus',
        timestamp: '2026-09-30T13:00:00.000Z',
        retainers: [
          {
            retainerName: 'Bags',
            retainerId: '12345678901234567',
            lastUpdated: '2026-09-30T09:00:00.000Z',
            bags: [{ bagName: 'RetainerInventory', items: [] }],
          },
        ],
      });

      expect(result).toMatchObject({ characterCached: true, retainersCached: 0, staleSkipped: 1 });
      expect(retainerInvRepo.save).not.toHaveBeenCalled();
    });

    it('ignores retainers without a usable id', async () => {
      charInvRepo.findOne.mockResolvedValue(null);

      const result = await svc.ingest({
        characterName: 'Foo Bar',
        retainers: [{ retainerName: 'Bags', bags: [] }],
      });

      expect(result).toMatchObject({ retainersCached: 0 });
      expect(retainerInvRepo.save).not.toHaveBeenCalled();
    });

    it('caches every character from the characters array with their own retainers', async () => {
      charInvRepo.findOne.mockResolvedValue(null);
      retainerInvRepo.findOne.mockResolvedValue(null);

      const result = await svc.ingest({
        characterName: 'Current Char',
        homeWorld: 'Cerberus',
        timestamp: '2026-09-30T10:00:00.000Z',
        playerInventory: [{ bagName: 'Inventory1', items: [] }],
        retainers: [{ retainerName: 'TopLevel', retainerId: '1', bags: [] }],
        characters: [
          {
            characterName: 'Foo Bar',
            homeWorld: 'Cerberus',
            timestamp: '2026-09-30T09:30:00.000Z',
            playerInventory: [{ bagName: 'Inventory1', items: [] }],
            retainers: [
              {
                retainerName: 'Bags',
                retainerId: '12345678901234567',
                lastUpdated: '2026-09-30T09:00:00.000Z',
                bags: [],
              },
            ],
          },
          {
            characterName: 'Alt Char',
            homeWorld: 'Lich',
            playerInventory: [],
            retainers: [
              {
                retainerName: 'Seller',
                retainerId: '98765432109876543',
                bags: [],
              },
            ],
          },
        ],
      });

      expect(result).toMatchObject({
        status: 'accepted',
        source: 'Current Char',
        characterCached: true,
        retainersCached: 2,
        staleSkipped: 0,
      });

      const createdKeys = charInvRepo.create.mock.calls.map(
        (call) => call[0].characterKey,
      );
      expect(createdKeys).toEqual(['foo bar@cerberus', 'alt char@lich']);

      const createdRetainers = retainerInvRepo.create.mock.calls.map(
        (call) => call[0],
      );
      expect(createdRetainers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            retainerId: '12345678901234567',
            ownerKey: 'foo bar@cerberus',
          }),
          expect.objectContaining({
            retainerId: '98765432109876543',
            ownerKey: 'alt char@lich',
          }),
        ]),
      );
      // Top-level legacy retainers must be ignored when characters[] exists.
      expect(createdRetainers).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ retainerId: '1' }),
        ]),
      );
      expect(rmqEmit()).toHaveBeenCalledTimes(1);
    });

    it('skips stale characters inside the characters array', async () => {
      charInvRepo.findOne.mockImplementation(async ({ where }) =>
        where.characterKey === 'foo bar@cerberus'
          ? {
              characterKey: 'foo bar@cerberus',
              lastReportedAt: new Date('2026-09-30T12:00:00.000Z'),
            }
          : null,
      );
      retainerInvRepo.findOne.mockResolvedValue(null);

      const result = await svc.ingest({
        characters: [
          {
            characterName: 'Foo Bar',
            homeWorld: 'Cerberus',
            timestamp: '2026-09-30T10:00:00.000Z',
          },
          {
            characterName: 'Fresh Char',
            homeWorld: 'Lich',
            timestamp: '2026-09-30T11:00:00.000Z',
          },
        ],
      });

      expect(result).toMatchObject({
        characterCached: true,
        retainersCached: 0,
        staleSkipped: 1,
      });
      // Only the fresh character is written; the stale one is skipped.
      expect(charInvRepo.create).toHaveBeenCalledTimes(1);
      expect(charInvRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ characterKey: 'fresh char@lich' }),
      );
      expect(charInvRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('getNetWorth', () => {
    it('values stock at universalis market price and at custom prices', async () => {
      matRepo.find.mockResolvedValue([
        {
          ...material,
          currentStock: 10,
          marketPrice: 100,
          myPrice: 150,
          npcPrice: null,
        },
        {
          ...material,
          id: 'mat-2',
          name: 'Iron Ore',
          currentStock: 5,
          marketPrice: 40,
          myPrice: null,
          npcPrice: null,
        },
        {
          ...material,
          id: 'mat-3',
          name: 'Vendor Item',
          currentStock: 2,
          marketPrice: null,
          myPrice: null,
          npcPrice: 7,
        },
        {
          ...material,
          id: 'mat-4',
          name: 'Unpriced',
          currentStock: 3,
          marketPrice: null,
          myPrice: null,
          npcPrice: null,
        },
      ] as BaseMaterial[]);

      const result = await svc.getNetWorth();

      // market: 10*100 + 5*40 + 2*0 + 3*0
      expect(result.marketNetWorth).toBe(1200);
      // my: 10*150 + 5*40 + 2*7 + 3*0
      expect(result.myNetWorth).toBe(1714);
      expect(result.materialCount).toBe(4);
      expect(result.unpricedCount).toBe(1);
    });
  });
});
