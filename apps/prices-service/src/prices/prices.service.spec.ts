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
    };

    cache = {
      reset: jest.fn().mockResolvedValue(undefined),
    };

    rmqClient = {
      emit: jest.fn().mockReturnValue({ subscribe: jest.fn() }),
    };

    settingRepo = {
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
    expect(rmqClient.emit).toHaveBeenCalledWith('universalis_price_refresh', { force: true });
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
      partRepo.find.mockResolvedValue([hull, stern]);
      setRepo.find.mockResolvedValue([fullSet]);

      const res = await service.findSets();

      expect(res.total).toBe(1);
      const set = res.items[0];
      // iron effective price 10 -> hull cost 50, stern cost 20
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
      partRepo.find.mockResolvedValue([hull, stern]);
      setRepo.find.mockResolvedValue([fullSet]);

      const res = await service.findSets();

      expect(res.items[0].totalMaterialCost).toBe(180); // 5*20 + 2*2*20
      expect(res.items[0].totalProfit).toBe(80);
      (iron as any).myPrice = null;
    });

    it('should create a set and verify referenced parts exist', async () => {
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
});
