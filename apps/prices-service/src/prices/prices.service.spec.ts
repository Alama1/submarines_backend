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

  describe('Anomaly ignore list', () => {
    it('should mark a material as ignored and reset the cache', async () => {
      await service.setAnomalyIgnore('mat-1', true);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'mat-1', anomalyIgnore: true }),
      );
      expect(cache.reset).toHaveBeenCalled();
    });

    it('should un-ignore a material', async () => {
      repo.findOne.mockResolvedValueOnce({ ...mockMaterial, anomalyIgnore: true });
      await service.setAnomalyIgnore('mat-1', false);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'mat-1', anomalyIgnore: false }),
      );
    });

    it('should throw when ignoring a missing material', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(service.setAnomalyIgnore('nope', true)).rejects.toThrow(
        NotFoundException,
      );
    });
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
    const plate = {
      id: 'plate',
      name: 'Iron Plate',
      marketPrice: 50,
      myPrice: null,
      npcPrice: null,
      recipe: [],
    } as unknown as BaseMaterial;
    const alloy = {
      id: 'alloy',
      name: 'Steel Alloy',
      marketPrice: 900,
      myPrice: null,
      npcPrice: null,
      recipe: [
        { ingredientMaterialId: 'ingot', quantity: 1 },
        { ingredientMaterialId: 'plate', quantity: 1 },
      ],
    } as unknown as BaseMaterial;
    // Part that consumes the crafted ingot (and alloy in the multi-tier test)
    const hull = {
      id: 'shark_hull',
      name: 'Shark Hull',
      price: 100,
      materials: [
        { material: ingot, quantity: 2 },
        { material: alloy, quantity: 1 },
      ],
    } as unknown as SubmarinePart;

    it('should compare craft cost against custom prices', async () => {
      repo.find.mockResolvedValue([ore, shard, ingot]);
      partRepo.find.mockResolvedValue([
        { ...hull, materials: [{ material: ingot, quantity: 2 }] },
      ]);

      const res = await service.findAnomalies();

      expect(res.total).toBe(1);
      const item = res.items[0];
      expect(item.id).toBe('ingot');
      expect(item.craftCost).toBe(250); // 2*100 + 5*10
      expect(item.craftCount).toBe(1); // own craft only
      expect(item.diff).toBe(-50); // craft cheaper than custom price
      expect(Math.abs(item.diffPct!)).toBeCloseTo(16.67, 1);
      expect(item.incomplete).toBe(false);
      // custom price clears the craft cost -> not flagged by default
      expect(item.isAnomaly).toBe(false);
      expect(res.anomalyCount).toBe(0);
      expect(res.thresholds).toEqual({ desiredDiff: 0, desiredDiffOffset: 0 });
    });

    it('should flag when the price gap is below the desired diff', async () => {
      repo.find.mockResolvedValue([ore, shard, ingot]);
      partRepo.find.mockResolvedValue([
        { ...hull, materials: [{ material: ingot, quantity: 2 }] },
      ]);
      // gap = myPrice(300) - craftCost(250) = 50, desired diff = 100 -> flagged
      settingRepo.find.mockResolvedValue([
        { key: 'anomalies.desiredDiff', value: '100' },
      ]);

      const res = await service.findAnomalies();

      expect(res.thresholds).toEqual({ desiredDiff: 100, desiredDiffOffset: 0 });
      expect(res.items[0].isAnomaly).toBe(true);
      expect(res.anomalyCount).toBe(1);
    });

    it('should not flag within the desired diff offset', async () => {
      repo.find.mockResolvedValue([ore, shard, ingot]);
      partRepo.find.mockResolvedValue([
        { ...hull, materials: [{ material: ingot, quantity: 2 }] },
      ]);
      // min gap = 100 - 100 = 0; gap of 50 is fine -> not flagged
      settingRepo.find.mockResolvedValue([
        { key: 'anomalies.desiredDiff', value: '100' },
        { key: 'anomalies.desiredDiffOffset', value: '100' },
      ]);

      const res = await service.findAnomalies();

      expect(res.thresholds).toEqual({ desiredDiff: 100, desiredDiffOffset: 100 });
      expect(res.items[0].isAnomaly).toBe(false);
      expect(res.anomalyCount).toBe(0);
    });

    it('should flag when the custom price is below craft cost', async () => {
      const underpriced = { ...ingot, myPrice: 200 };
      repo.find.mockResolvedValue([ore, shard, underpriced]);
      partRepo.find.mockResolvedValue([
        { ...hull, materials: [{ material: underpriced, quantity: 2 }] },
      ]);

      const res = await service.findAnomalies();

      expect(res.items[0].diff).toBe(50); // craft cost above custom price
      expect(res.items[0].isAnomaly).toBe(true);
      expect(res.anomalyCount).toBe(1);
    });

    it('should not flag when desired diff is disabled', async () => {
      const underpriced = { ...ingot, myPrice: 200 };
      repo.find.mockResolvedValue([ore, shard, underpriced]);
      partRepo.find.mockResolvedValue([
        { ...hull, materials: [{ material: underpriced, quantity: 2 }] },
      ]);
      settingRepo.find.mockResolvedValue([
        { key: 'anomalies.desiredDiff', value: '' },
      ]);

      const res = await service.findAnomalies();

      expect(res.thresholds).toEqual({ desiredDiff: null, desiredDiffOffset: 0 });
      expect(res.items[0].isAnomaly).toBe(false);
      expect(res.anomalyCount).toBe(0);
    });

    it('should exclude ignored materials unless includeIgnored is set', async () => {
      const ignoredIngot = { ...ingot, myPrice: 200, anomalyIgnore: true };
      repo.find.mockResolvedValue([ore, shard, ignoredIngot]);
      partRepo.find.mockResolvedValue([
        { ...hull, materials: [{ material: ignoredIngot, quantity: 2 }] },
      ]);

      const hidden = await service.findAnomalies();
      expect(hidden.total).toBe(0);

      const shown = await service.findAnomalies(true);
      expect(shown.total).toBe(1);
      expect(shown.items[0].id).toBe('ingot');
      expect(shown.items[0].anomalyIgnore).toBe(true);
    });

    it('should save settings and clear caches', async () => {
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
        desiredDiff: 500,
        desiredDiffOffset: 100,
      });

      expect(settingRepo.insert).toHaveBeenCalledWith({
        key: 'anomalies.desiredDiff',
        value: '500',
      });
      expect(settingRepo.insert).toHaveBeenCalledWith({
        key: 'anomalies.desiredDiffOffset',
        value: '100',
      });
      expect(cache.reset).toHaveBeenCalled();
      expect(res).toEqual({ desiredDiff: 500, desiredDiffOffset: 100 });
    });

    it('should only list craftables used in submarine part crafting', async () => {
      const unrelated = {
        id: 'potion',
        name: 'Unused Potion',
        marketPrice: 999,
        myPrice: 5,
        npcPrice: null,
        recipe: [{ ingredientMaterialId: 'ore', quantity: 1 }],
      } as unknown as BaseMaterial;
      repo.find.mockResolvedValue([ore, shard, ingot, unrelated]);
      partRepo.find.mockResolvedValue([
        { ...hull, materials: [{ material: ingot, quantity: 2 }] },
      ]);

      const res = await service.findAnomalies();

      expect(res.items.map((i) => i.id)).toEqual(['ingot']);
      expect(res.total).toBe(1);
    });

    it('should count crafts recursively: own craft plus craftable ingredients', async () => {
      // alloy = 1x ingot + 1x plate; ingot is craftable, plate is raw
      repo.find.mockResolvedValue([ore, shard, ingot, plate, alloy]);
      partRepo.find.mockResolvedValue([
        { ...hull, materials: [{ material: alloy, quantity: 1 }] },
      ]);

      const res = await service.findAnomalies();

      // ingot is reachable via alloy's recipe, so both are listed
      expect(res.total).toBe(2);
      const byId = new Map(res.items.map((i) => [i.id, i]));
      expect(byId.get('alloy')!.craftCount).toBe(2); // own craft + ingot's craft
      expect(byId.get('ingot')!.craftCount).toBe(1);
    });

    it('should mark craft costs as incomplete when an ingredient has no price', async () => {
      const unpricedOre = { ...ore, marketPrice: null };
      repo.find.mockResolvedValue([unpricedOre, shard, ingot]);
      partRepo.find.mockResolvedValue([
        { ...hull, materials: [{ material: ingot, quantity: 2 }] },
      ]);

      const res = await service.findAnomalies();

      expect(res.items[0].incomplete).toBe(true);
      expect(res.items[0].craftCost).toBe(50); // only the priced shards count
    });

    it('should skip materials without craft recipes', async () => {
      repo.find.mockResolvedValue([ore, shard]);
      partRepo.find.mockResolvedValue([hull]);

      const res = await service.findAnomalies();

      expect(res.total).toBe(0);
    });
  });
});
