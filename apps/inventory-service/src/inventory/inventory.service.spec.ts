import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BaseMaterial,
  CharacterInventory,
  CraftClaim,
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
    find: jest.Mock;
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

  const claim = (
    id: string,
    nickname: string,
    items: Array<{ materialId: string; quantity: number }>,
  ) =>
    ({
      id,
      nickname,
      status: 'confirmed',
      createdAt: new Date(),
      items,
    }) as CraftClaim;

  beforeEach(async () => {
    process.env.INTERNAL_TOKEN = 'test-internal-token';

    matRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
      save: jest.fn(),
    };
    claimRepo = {
      find: jest.fn(),
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
        { provide: getRepositoryToken(CraftClaim), useValue: claimRepo },
        { provide: getRepositoryToken(CharacterInventory), useValue: charInvRepo },
        { provide: getRepositoryToken(RetainerInventory), useValue: retainerInvRepo },
        { provide: CACHE_MANAGER, useValue: { reset: jest.fn() } },
        { provide: 'INVENTORY_RMQ_CLIENT', useValue: { emit: jest.fn() } },
      ],
    }).compile();

    svc = module.get<InventoryService>(InventoryService);
  });

  describe('findMissing', () => {
    const makeQb = (result: unknown[]) => ({
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(result),
    });

    const orderAggregate = (materials: unknown[]) =>
      ({
        ok: true,
        json: async () => ({ aggregate: { materials } }),
      }) as Response;

    afterEach(() => {
      delete process.env.ORDERS_SERVICE_URL;
      jest.restoreAllMocks();
    });

    it('aggregates claimed amounts and computes the unclaimed remainder', async () => {
      const qb = makeQb([material]);
      matRepo.createQueryBuilder.mockReturnValue(qb);
      claimRepo.find.mockResolvedValue([
        claim('c1', 'Alice', [{ materialId: 'mat-1', quantity: 3000 }]),
        claim('c2', 'Bob', [{ materialId: 'mat-1', quantity: 2000 }]),
      ]);

      const result = await svc.findMissing(undefined, 1, 50);

      expect(result.total).toBe(1);
      expect(result.items[0]).toMatchObject({
        name: 'Cobalt Ingot',
        deficit: 10000,
        claimed: 5000,
        remaining: 5000,
        orderNeeded: 0,
        orderMissing: 0,
        totalMissing: 10000,
      });
      expect(result.items[0].claims).toHaveLength(2);
    });

    it('only counts confirmed and completed claims', async () => {
      const qb = makeQb([material]);
      matRepo.createQueryBuilder.mockReturnValue(qb);
      claimRepo.find.mockResolvedValue([]);

      await svc.findMissing(undefined, 1, 50);

      expect(claimRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: In(['confirmed', 'completed']) },
        }),
      );
    });

    it('never reports a negative remainder when claims exceed the deficit', async () => {
      const qb = makeQb([material]);
      matRepo.createQueryBuilder.mockReturnValue(qb);
      claimRepo.find.mockResolvedValue([
        claim('c1', 'Alice', [{ materialId: 'mat-1', quantity: 12000 }]),
      ]);

      const result = await svc.findMissing(undefined, 1, 50);

      expect(result.items[0].claimed).toBe(12000);
      expect(result.items[0].remaining).toBe(0);
    });

    it('filters the merged list by search', async () => {
      const other = { ...material, id: 'mat-2', name: 'Iron Ore' };
      const qb = makeQb([material, other]);
      matRepo.createQueryBuilder.mockReturnValue(qb);
      claimRepo.find.mockResolvedValue([]);

      const result = await svc.findMissing('cobalt', 1, 50);

      expect(result.total).toBe(1);
      expect(result.items[0].name).toBe('Cobalt Ingot');
    });

    it('excludes submarine part rows from the missing-materials list', async () => {
      const qb = makeQb([]);
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
      const qb = makeQb([]);
      matRepo.createQueryBuilder.mockReturnValue(qb);
      claimRepo.find.mockResolvedValue([]);

      await svc.findMissing(undefined, 1, 50);

      expect(qb.andWhere).toHaveBeenCalledWith('m.desiredQuantity > 0');
    });

    it('adds in-progress order demand on top of the stock-target deficit', async () => {
      const qb = makeQb([{ ...material, currentStock: 6000 }]);
      matRepo.createQueryBuilder.mockReturnValue(qb);
      claimRepo.find.mockResolvedValue([
        claim('c1', 'Alice', [{ materialId: 'mat-1', quantity: 2000 }]),
      ]);
      process.env.ORDERS_SERVICE_URL = 'http://orders-test:3003';
      jest.spyOn(global, 'fetch').mockResolvedValue(
        orderAggregate([{ materialId: 'mat-1', needed: 30000, missing: 24000 }]),
      );

      const result = await svc.findMissing(undefined, 1, 50);

      expect(result.items[0]).toMatchObject({
        deficit: 4000,
        orderNeeded: 30000,
        orderMissing: 24000,
        // orders eat the 6000 stock, then the 10000 target is refilled from zero
        totalMissing: 34000,
        // claims count against the combined need
        remaining: 32000,
      });
    });

    it('refills the target from surviving stock, not from stock the orders consume', async () => {
      // the Iron Nails shape: 9844 in stock, order needs 18759 (missing 8915),
      // target 13560 — after the order nothing is left, so the full target
      // must be gathered: 8915 + 13560 = 22475.
      const qb = makeQb([
        { ...material, id: 'nails', name: 'Iron Nails', currentStock: 9844, desiredQuantity: 13560 },
      ]);
      matRepo.createQueryBuilder.mockReturnValue(qb);
      claimRepo.find.mockResolvedValue([
        claim('c1', 'Alice', [{ materialId: 'nails', quantity: 13560 }]),
      ]);
      process.env.ORDERS_SERVICE_URL = 'http://orders-test:3003';
      jest.spyOn(global, 'fetch').mockResolvedValue(
        orderAggregate([{ materialId: 'nails', needed: 18759, missing: 8915 }]),
      );

      const result = await svc.findMissing(undefined, 1, 50);

      expect(result.items[0]).toMatchObject({
        totalMissing: 22475,
        remaining: 8915, // the 13560 claim covers the target, the order gap stays open
      });
    });

    it('keeps target-refill demand for rows whose order is fully covered by stock', async () => {
      // order fully covered (missing 0), but it consumes stock below the target
      const qb = makeQb([
        { ...material, id: 'rivets', name: 'Cobalt Rivets', currentStock: 19229, desiredQuantity: 31560 },
      ]);
      matRepo.createQueryBuilder.mockReturnValue(qb);
      claimRepo.find.mockResolvedValue([]);
      process.env.ORDERS_SERVICE_URL = 'http://orders-test:3003';
      jest.spyOn(global, 'fetch').mockResolvedValue(
        orderAggregate([{ materialId: 'rivets', needed: 10101, missing: 0 }]),
      );

      const result = await svc.findMissing(undefined, 1, 50);

      // 19229 - 10101 = 9128 left; 31560 - 9128 = 22432 to refill
      expect(result.items[0]).toMatchObject({ orderMissing: 0, totalMissing: 22432 });
    });

    it('lists materials only demanded by in-progress builds and sorts by total missing', async () => {
      const qb = makeQb([material]);
      matRepo.createQueryBuilder.mockReturnValue(qb);
      matRepo.find.mockResolvedValue([
        {
          ...material,
          id: 'mat-order-only',
          name: 'Order Only Ore',
          desiredQuantity: 0,
          currentStock: 0,
        },
      ]);
      claimRepo.find.mockResolvedValue([]);
      process.env.ORDERS_SERVICE_URL = 'http://orders-test:3003';
      jest.spyOn(global, 'fetch').mockResolvedValue(
        orderAggregate([
          { materialId: 'mat-order-only', needed: 900, missing: 900 },
        ]),
      );

      const result = await svc.findMissing(undefined, 1, 50);

      expect(result.total).toBe(2);
      expect(result.items[0]).toMatchObject({ name: 'Cobalt Ingot', totalMissing: 10000 });
      expect(result.items[1]).toMatchObject({
        name: 'Order Only Ore',
        desiredQuantity: 0,
        deficit: 0,
        orderMissing: 900,
        totalMissing: 900,
      });
    });

    it('falls back to stock targets only when orders-service is unreachable', async () => {
      const qb = makeQb([material]);
      matRepo.createQueryBuilder.mockReturnValue(qb);
      claimRepo.find.mockResolvedValue([]);
      process.env.ORDERS_SERVICE_URL = 'http://orders-test:3003';
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('connect ECONNREFUSED'));

      const result = await svc.findMissing(undefined, 1, 50);

      expect(result.items[0]).toMatchObject({
        orderNeeded: 0,
        orderMissing: 0,
        totalMissing: 10000,
      });
    });

    it('paginates the merged list in memory', async () => {
      const second = { ...material, id: 'mat-2', name: 'Iron Ore', desiredQuantity: 100 };
      const qb = makeQb([material, second]);
      matRepo.createQueryBuilder.mockReturnValue(qb);
      claimRepo.find.mockResolvedValue([]);

      const result = await svc.findMissing(undefined, 2, 1);

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Iron Ore');
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
