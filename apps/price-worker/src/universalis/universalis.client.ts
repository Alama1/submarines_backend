import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface UniversalisAggregatedPrice {
  price: number;
  worldId?: number;
}

export interface UniversalisQualityStats {
  minListing?: {
    world?: UniversalisAggregatedPrice;
    dc?: UniversalisAggregatedPrice;
    region?: UniversalisAggregatedPrice;
  };
  averageSalePrice?: {
    world?: UniversalisAggregatedPrice;
    dc?: UniversalisAggregatedPrice;
    region?: UniversalisAggregatedPrice;
  };
}

export interface UniversalisAggregatedItem {
  itemId: number;
  nq?: UniversalisQualityStats;
  hq?: UniversalisQualityStats;
}

export interface UniversalisAggregatedResponse {
  results?: UniversalisAggregatedItem[];
  failedItems?: number[];
}

@Injectable()
export class UniversalisClient {
  private readonly logger = new Logger(UniversalisClient.name);
  private readonly baseUrl = 'https://universalis.app/api/v2';

  constructor(private readonly config: ConfigService) {}

  getWorld(): string {
    return this.config.get<string>('UNIVERSALIS_WORLD', 'Louisoix');
  }

  async fetchMarketPrices(
    itemIds: number[],
    worldOverride?: string,
  ): Promise<Map<number, number>> {
    const priceMap = new Map<number, number>();
    if (!itemIds.length) return priceMap;

    const world = worldOverride?.trim() || this.getWorld();
    const joinedIds = itemIds.join(',');
    // The aggregated endpoint serves pre-computed world/DC/region stats —
    // cheap enough to batch hundreds of items in a single request, unlike
    // the raw market-board endpoint which times out beyond a few.
    const url = `${this.baseUrl}/aggregated/${encodeURIComponent(world)}/${joinedIds}`;

    try {
      this.logger.debug(`Fetching Universalis aggregated prices for ${itemIds.length} items (scope: "${world}")...`);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'FF14-Submarines-Backend/1.0' },
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        this.logger.warn(`Universalis API returned HTTP ${res.status} for scope ${world}`);
        return priceMap;
      }

      const data = (await res.json()) as UniversalisAggregatedResponse;

      for (const item of data.results ?? []) {
        const price = this.extractPrice(item);
        if (price !== null) {
          priceMap.set(item.itemId, price);
        }
      }
      if (data.failedItems?.length) {
        this.logger.warn(`Universalis could not aggregate items: ${data.failedItems.join(', ')}`);
      }
    } catch (err: unknown) {
      this.logger.error(`Failed to fetch Universalis prices: ${(err as Error).message}`, (err as Error).stack);
    }

    return priceMap;
  }

  /**
   * Region average sale price, taking the cheaper of NQ/HQ. When an item has
   * no (recent) sales history the chain degrades to the cheaper NQ/HQ region
   * min listing, then DC, then the scope's own world.
   */
  private extractPrice(item: UniversalisAggregatedItem): number | null {
    const levels: Array<'region' | 'dc' | 'world'> = ['region', 'dc', 'world'];
    for (const level of levels) {
      const avg = pickLower(
        item.nq?.averageSalePrice?.[level]?.price,
        item.hq?.averageSalePrice?.[level]?.price,
      );
      if (avg !== null) return Math.round(avg);

      const min = pickLower(
        item.nq?.minListing?.[level]?.price,
        item.hq?.minListing?.[level]?.price,
      );
      if (min !== null) return Math.round(min);
    }
    return null;
  }
}

function pickLower(
  a: number | undefined | null,
  b: number | undefined | null,
): number | null {
  const values = [a, b].filter(
    (v): v is number => v !== undefined && v !== null && !Number.isNaN(v),
  );
  return values.length ? Math.min(...values) : null;
}
