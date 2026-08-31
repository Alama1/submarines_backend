import { Test, TestingModule } from '@nestjs/testing';
import { XivApiClient } from './xivapi.client';

describe('XivApiClient', () => {
  let client: XivApiClient;
  let fetchMock: jest.Mock;

  const mockFetch = (payload: unknown, ok = true, status = 200) => {
    fetchMock.mockResolvedValueOnce({
      ok,
      status,
      json: async () => payload,
    });
  };

  beforeEach(async () => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const module: TestingModule = await Test.createTestingModule({
      providers: [XivApiClient],
    }).compile();

    client = module.get<XivApiClient>(XivApiClient);
  });

  it('should be defined', () => {
    expect(client).toBeDefined();
  });

  it('builds the XIVAPI search URL with the encoded name query', async () => {
    mockFetch({ results: [{ row_id: 5060 }] });

    await client.searchItemId('Darksteel Ingot');

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('https://v2.xivapi.com/api/search');
    expect(url).toContain('sheets=Item');
    expect(url).toContain('language=en');
    expect(url).toContain('limit=1');
    expect(url).toContain(encodeURIComponent('Name~"Darksteel Ingot"'));
  });

  it('returns the first result row_id', async () => {
    mockFetch({
      results: [
        { row_id: 5060, fields: { Name: 'Darksteel Ingot', ID: 5060 } },
        { row_id: 9999 },
      ],
    });

    await expect(client.searchItemId('Darksteel Ingot')).resolves.toBe(5060);
  });

  it('returns null when there are no results', async () => {
    mockFetch({ results: [] });

    await expect(client.searchItemId('Nonexistent Item')).resolves.toBeNull();
  });

  it('returns null on non-OK responses', async () => {
    mockFetch({}, false, 500);

    await expect(client.searchItemId('Darksteel Ingot')).resolves.toBeNull();
  });

  it('returns null when fetch throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    await expect(client.searchItemId('Darksteel Ingot')).resolves.toBeNull();
  });
});
