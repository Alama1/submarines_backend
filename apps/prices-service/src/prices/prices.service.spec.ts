import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AppSetting, BaseMaterial, MaterialSource, PartSet, SubmarinePart } from '@ff14/entities';
import { UNIVERSALIS_WORLD_KEY } from '@ff14/types';
import { PricesService } from './prices.service';

describe('PricesService', () => {
  beforeAll(() => {
    process.env.INTERNAL_TOKEN = 'test-internal-token';
  });

  let service: PricesService;
  let repo: any;
  let cache: any;
  let rmqClient: any;
  let settingRepo: any;
  let partRepo: any;
  let setRepo: any;
  let ds: any;

  const mockMaterial: Partial<BaseMaterial> = {
    id: 'mat-1',
    name: 'Zinc Ore',
    itemId: 5530,
    marketPrice: 400,
    myPrice: null,
    npcPrice: 10,
    whereToBuy: MaterialSource.MARKET,
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    repo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockMaterial], 1]),
      }),
      findOne: jest.fn().mockResolvedValue({ ...mockMaterial }),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      find: jest.fn().mockResolvedValue([]),
    };

    cache = {
      reset: jest.fn().mockResolvedValue(undefined),
    };

    rmqClient = {
      emit: jest.fn().mockReturnValue({ subscribe: jest.fn() }),
    };

    settingRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      insert: jest.fn().mockResolvedValue(undefined),
    };

    partRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    setRepo = {
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    ds = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricesService,
        { provide: getRepositoryToken(BaseMaterial), useValue: repo },
        { provide: getRepositoryToken(SubmarinePart), useValue: partRepo },
        { provide: getRepositoryToken(AppSetting), useValue: settingRepo },
        { provide: getRepositoryToken(PartSet), useValue: setRepo },
        { provide: DataSource, useValue: ds },
        { provide: CACHE_MANAGER, useValue: cache },
        { provide: 'PRICE_RMQ_CLIENT', useValue: rmqClient },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('Louisoix') },
        },
      ],
    }).compile();

    service = module.get<PricesService>(PricesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should find all materials and calculate effectivePrice', async () => {
    const res = await service.findAll();
    expect(res.total).toBe(1);
    expect(res.items[0].effectivePrice).toBe(400); // marketPrice takes effect when myPrice is null
  });

  it('should update myPrice and reset cache', async () => {
    const res = await service.updateMyPrice('mat-1', { myPrice: 350 });
    expect(res.myPrice).toBe(350);
    expect(res.effectivePrice).toBe(350);
    expect(cache.reset).toHaveBeenCalled();
  });

  it('should publish a refresh job to the price-worker queue', () => {
    const res = service.triggerRefresh();
    expect(res.status).toBe('queued');
    expect(rmqClient.emit).toHaveBeenCalledWith(
      'universalis_price_refresh',
      { token: 'test-internal-token', payload: { force: true } },
    );
  });

  it('should clear myPrice and fall back to marketPrice', async () => {
    repo.findOne.mockResolvedValueOnce({ ...mockMaterial, myPrice: 350 });
    const res = await service.clearMyPrice('mat-1');
    expect(res.myPrice).toBeNull();
    expect(res.effectivePrice).toBe(400);
    expect(cache.reset).toHaveBeenCalled();
  });

  describe('Universalis settings', () => {
    it('should return the default world when no DB setting exists', async () => {
      const res = await service.getUniversalisSettings();
      expect(settingRepo.findOne).toHaveBeenCalledWith({
        where: { key: UNIVERSALIS_WORLD_KEY },
      });
      expect(res).toEqual({ world: 'Louisoix', source: 'default' });
    });

    it('should return the world from the DB when set', async () => {
      settingRepo.findOne.mockResolvedValueOnce({
        key: UNIVERSALIS_WORLD_KEY,
        value: 'Mateus',
      });

      const res = await service.getUniversalisSettings();
      expect(res).toEqual({ world: 'Mateus', source: 'database' });
    });

    it('should insert a new world setting and reset the cache', async () => {
      const res = await service.updateUniversalisWorld({ world: 'Mateus' });

      expect(settingRepo.insert).toHaveBeenCalledWith({
        key: UNIVERSALIS_WORLD_KEY,
        value: 'Mateus',
      });
      expect(res).toEqual({ world: 'Mateus', source: 'database' });
      expect(cache.reset).toHaveBeenCalled();
    });

    it('should update the existing world setting and trim the value', async () => {
      settingRepo.findOne.mockResolvedValueOnce({
        key: UNIVERSALIS_WORLD_KEY,
        value: 'Louisoix',
      });

      const res = await service.updateUniversalisWorld({ world: '  Mateus  ' });

      expect(settingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ key: UNIVERSALIS_WORLD_KEY, value: 'Mateus' }),
      );
      expect(settingRepo.insert).not.toHaveBeenCalled();
      expect(res.world).toBe('Mateus');
    });
  });

  describe('Part sets', () => {
    const iron: Partial<BaseMaterial> = {
      id: 'iron',
      name: 'Iron Ore',
      marketPrice: 10,
      myPrice: null,
      npcPrice: null,
    };
    const hull = {
      id: 'shark_hull',
      name: 'Shark Hull',
      price: 100,
      materials: [{ material: iron, quantity: 5 }],
    } as unknown as SubmarinePart;
    const stern = {
      id: 'shark_stern',
      name: 'Shark Stern',
      price: 80,
      materials: [{ material: iron, quantity: 2 }],
    } as unknown as SubmarinePart;
    const fullSet = {
      id: 'set-1',
      name: 'Full Shark Set',
      description: null,
      items: [
        { part: hull, partName: 'Shark Hull', quantity: 1 },
        { part: stern, partName: 'Shark Stern', quantity: 2 },
      ],
    };

    it('should compute set profit from live effective prices via expanded recipes', async () => {
      repo.find.mockResolvedValue([iron]);
      partRepo.find.mockResolvedValue([hull, stern]);
      setRepo.find.mockResolvedValue([fullSet]);

      const res = await service.findSets();

      expect(res.total).toBe(1);
      const set = res.items[0];
      expect(set.items[0]).toMatchObject({
        partId: 'shark_hull',
        unitSalePrice: 100,
        materialCostPerUnit: 50,
        saleTotal: 100,
        materialCostTotal: 50,
        profit: 50,
      });
      expect(set.items[1]).toMatchObject({
        partId: 'shark_stern',
        saleTotal: 160,
        materialCostTotal: 40,
        profit: 120,
      });
      expect(set.totalSale).toBe(260);
      expect(set.totalMaterialCost).toBe(90);
      expect(set.totalProfit).toBe(170);
      expect(set.profitMarginPct).toBe(65);
    });

    it('should prefer myPrice override when valuing materials', async () => {
      (iron as any).myPrice = 20;
      repo.find.mockResolvedValue([iron]);
      partRepo.find.mockResolvedValue([hull, stern]);
      setRepo.find.mockResolvedValue([fullSet]);

      const res = await service.findSets();

      expect(res.items[0].totalMaterialCost).toBe(180); // 5*20 + 2*2*20
      expect(res.items[0].totalProfit).toBe(80);
      (iron as any).myPrice = null;
    });

    it('should create a set and verify referenced parts exist', async () => {
      repo.find.mockResolvedValue([iron]);
      partRepo.find.mockResolvedValue([hull]);
      const em = {
        create: jest.fn((_cls: any, data: any) => data),
        save: jest.fn(async (saved: any) => ({ id: 'set-1', ...saved })),
      };
      ds.transaction.mockImplementation(async (fn: any) => fn(em));

      const res = await service.createSet({
        name: 'Full Shark Set',
        items: [{ partId: 'shark_hull', quantity: 1 }],
      });

      expect(res.name).toBe('Full Shark Set');
      expect(res.totalProfit).toBe(50);
    });

    it('should reject creating a set with an unknown part', async () => {
      partRepo.find.mockResolvedValue([hull]);

      await expect(
        service.createSet({
          name: 'Bad Set',
          items: [{ partId: 'nope', quantity: 1 }],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should map unique-name violations to BadRequestException', async () => {
      partRepo.find.mockResolvedValue([hull]);
      const em = {
        create: jest.fn((_cls: any, data: any) => data),
        save: jest.fn(async () => {
          throw { code: '23505' };
        }),
      };
      ds.transaction.mockImplementation(async (fn: any) => fn(em));

      await expect(
        service.createSet({
          name: 'Full Shark Set',
          items: [{ partId: 'shark_hull', quantity: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should delete a set', async () => {
      await service.deleteSet('set-1');
      expect(setRepo.delete).toHaveBeenCalledWith('set-1');
    });

    it('should throw when deleting a missing set', async () => {
      setRepo.delete.mockResolvedValueOnce({ affected: 0 });
      await expect(service.deleteSet('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('Price anomalies', () => {
    const ore = {
      id: 'ore',
      name: 'Iron Ore',
      marketPrice: 100,
      myPrice: null,
      npcPrice: null,
      recipe: [],
    } as unknown as BaseMaterial;
    const shard = {
      id: 'shard',
      name: 'Fire Shard',
      marketPrice: 10,
      myPrice: null,
      npcPrice: null,
      recipe: [],
    } as unknown as BaseMaterial;
    const ingot = {
      id: 'ingot',
      name: 'Iron Ingot',
      marketPrice: 400,
      myPrice: 300,
      npcPrice: null,
      recipe: [
        { ingredientMaterialId: 'ore', quantity: 2 },
        { ingredientMaterialId: 'shard', quantity: 5 },
      ],
    } as unknown as BaseMaterial;

    it('should compare craft cost against custom prices', async () => {
      repo.find.mockResolvedValue([ore, shard, ingot]);

      const res = await service.findAnomalies();

      expect(res.total).toBe(1);
      const item = res.items[0];
      expect(item.id).toBe('ingot');
      expect(item.craftCost).toBe(250); // 2*100 + 5*10
      expect(item.diff).toBe(-50); // craft cheaper than custom price
      expect(Math.abs(item.diffPct!)).toBeCloseTo(16.67, 1);
      expect(item.incomplete).toBe(false);
      expect(item.isAnomaly).toBe(true);
      expect(res.anomalyCount).toBe(1);
      expect(res.thresholds).toEqual({ thresholdPct: 10, thresholdGil: null });
    });

    it('should honour a custom % threshold and a gil threshold (OR logic)', async () => {
      repo.find.mockResolvedValue([ore, shard, ingot]);

      // % set to 90 (16.67% dev is below it) but gil set to 40 (|diff|=50 is above it)
      settingRepo.find.mockResolvedValue([
        { key: 'anomalies.thresholdPct', value: '90' },
        { key: 'anomalies.thresholdGil', value: '40' },
      ]);

      const res = await service.findAnomalies();

      expect(res.thresholds).toEqual({ thresholdPct: 90, thresholdGil: 40 });
      expect(res.items[0].isAnomaly).toBe(true); // flagged via the gil check
      expect(res.anomalyCount).toBe(1);
    });

    it('should not flag when both thresholds are disabled', async () => {
      repo.find.mockResolvedValue([ore, shard, ingot]);
      settingRepo.find.mockResolvedValue([
        { key: 'anomalies.thresholdPct', value: '' },
        { key: 'anomalies.thresholdGil', value: '' },
      ]);

      const res = await service.findAnomalies();

      expect(res.thresholds).toEqual({ thresholdPct: null, thresholdGil: null });
      expect(res.items[0].isAnomaly).toBe(false);
      expect(res.anomalyCount).toBe(0);
    });

    it('should save thresholds and clear caches', async () => {
      const store = new Map<string, string>();
      settingRepo.find.mockImplementation(async () =>
        [...store.entries()].map(([key, value]) => ({ key, value })),
      );
      settingRepo.findOne.mockImplementation(async ({ where }: any) =>
        store.has(where.key)
          ? { key: where.key, value: store.get(where.key) }
          : null,
      );
      settingRepo.insert.mockImplementation(async ({ key, value }: any) => {
        store.set(key, value);
      });
      settingRepo.save.mockImplementation(async (entity: any) => {
        store.set(entity.key, entity.value);
        return entity;
      });

      const res = await service.updateAnomalyThresholds({
        thresholdPct: 5,
        thresholdGil: null,
      });

      expect(settingRepo.insert).toHaveBeenCalledWith({
        key: 'anomalies.thresholdPct',
        value: '5',
      });
      expect(settingRepo.insert).toHaveBeenCalledWith({
        key: 'anomalies.thresholdGil',
        value: '',
      });
      expect(cache.reset).toHaveBeenCalled();
      expect(res).toEqual({ thresholdPct: 5, thresholdGil: null });
    });

    it('should mark craft costs as incomplete when an ingredient has no price', async () => {
      const unpricedOre = { ...ore, marketPrice: null };
      repo.find.mockResolvedValue([unpricedOre, shard, ingot]);

      const res = await service.findAnomalies();

      expect(res.items[0].incomplete).toBe(true);
      expect(res.items[0].craftCost).toBe(50); // only the priced shards count
    });

    it('should skip materials without craft recipes', async () => {
      repo.find.mockResolvedValue([ore, shard]);

      const res = await service.findAnomalies();

      expect(res.total).toBe(0);
    });
  });
});
