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
            nq: { minListing: { world: { price: 45 }, dc: { price: 42 }, region: { price: 36 } } },
          },
          {
            itemId: 3,
            nq: { minListing: { dc: { price: 40 } } },
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

    expect(map.get(2)).toBe(36); // region price wins
    expect(map.get(3)).toBe(40); // falls back to dc when region missing
    expect(map.get(4)).toBe(12); // falls back to world
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/aggregated/japan/2,3,4');
  });
});
