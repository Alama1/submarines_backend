import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AppSetting, BaseMaterial, MaterialSource, SubmarinePart } from '@ff14/entities';
import { UNIVERSALIS_WORLD_KEY } from '@ff14/types';
import { PricesService } from './prices.service';

describe('PricesService', () => {
  let service: PricesService;
  let repo: any;
  let cache: any;
  let rmqClient: any;
  let settingRepo: any;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricesService,
        { provide: getRepositoryToken(BaseMaterial), useValue: repo },
        { provide: getRepositoryToken(SubmarinePart), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(AppSetting), useValue: settingRepo },
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
});
