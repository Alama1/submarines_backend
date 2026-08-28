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
});
