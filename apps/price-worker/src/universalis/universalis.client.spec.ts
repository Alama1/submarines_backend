import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UniversalisClient } from './universalis.client';

describe('UniversalisClient', () => {
  let client: UniversalisClient;
  let config: any;

  beforeEach(async () => {
    config = {
      get: jest.fn().mockReturnValue('Louisoix'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UniversalisClient,
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    client = module.get<UniversalisClient>(UniversalisClient);
  });

  it('should be defined', () => {
    expect(client).toBeDefined();
    expect(client.getWorld()).toBe('Louisoix');
  });

  it('should return empty map for empty itemIds', async () => {
    const map = await client.fetchMarketPrices([]);
    expect(map.size).toBe(0);
  });

  it('should extract region prices from the aggregated endpoint', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            itemId: 2,
            nq: {
              minListing: { world: { price: 45 }, dc: { price: 42 }, region: { price: 36 } },
              averageSalePrice: { world: { price: 50.4 }, dc: { price: 55.1 }, region: { price: 663.375 } },
            },
            hq: {
              minListing: { region: { price: 30 } },
              averageSalePrice: { region: { price: 500 } },
            },
          },
          {
            itemId: 3,
            nq: {
              minListing: { dc: { price: 40 } },
              averageSalePrice: { dc: { price: 44.2 } },
            },
          },
          {
            itemId: 4,
            nq: { minListing: { world: { price: 12 } } },
          },
        ],
        failedItems: [],
      }),
    });
    (global as any).fetch = mockFetch;

    const map = await client.fetchMarketPrices([2, 3, 4], 'japan');

    expect(map.get(2)).toBe(500); // region average, lower of HQ (500) / NQ (663.375)
    expect(map.get(3)).toBe(44); // no region data -> dc average
    expect(map.get(4)).toBe(12); // no sales history -> min listing chain
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/aggregated/japan/2,3,4');
  });
});
