import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface UniversalisItemPrice {
  itemID?: number;
  minPrice?: number;
  minPriceNQ?: number;
  minPriceHQ?: number;
  currentAveragePrice?: number;
  currentAveragePriceNQ?: number;
  currentAveragePriceHQ?: number;
}

@Injectable()
export class UniversalisClient {
  private readonly logger = new Logger(UniversalisClient.name);
  private readonly baseUrl = 'https://universalis.app/api/v2';

  constructor(private readonly config: ConfigService) {}

  getWorld(): string {
    return this.config.get<string>('UNIVERSALIS_WORLD', 'Louisoix');
  }

  /**
   * Fetches latest market prices for a list of item IDs.
   * Returns a Map of itemId -> marketPrice (in gil).
   */
  async fetchMarketPrices(itemIds: number[]): Promise<Map<number, number>> {
    const priceMap = new Map<number, number>();
    if (!itemIds.length) return priceMap;

    const world = this.getWorld();
    const joinedIds = itemIds.join(',');
    const url = `${this.baseUrl}/${encodeURIComponent(world)}/${joinedIds}`;

    try {
      this.logger.debug(`Fetching Universalis prices for ${itemIds.length} items from world "${world}"...`);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'FF14-Submarines-Backend/1.0' },
      });

      if (!res.ok) {
        this.logger.warn(`Universalis API returned HTTP ${res.status} for world ${world}`);
        return priceMap;
      }

      const data = (await res.json()) as {
        items?: Record<string, UniversalisItemPrice>;
        itemID?: number;
        minPrice?: number;
        minPriceNQ?: number;
        currentAveragePriceNQ?: number;
        currentAveragePrice?: number;
      };

      if (data.items) {
        // Multi-item response
        for (const [idStr, itemData] of Object.entries(data.items)) {
          const itemId = parseInt(idStr, 10);
          const price = this.extractPrice(itemData);
          if (price !== null) {
            priceMap.set(itemId, price);
          }
        }
      } else if (data.itemID) {
        // Single item response
        const price = this.extractPrice(data);
        if (price !== null) {
          priceMap.set(data.itemID, price);
        }
      }
    } catch (err: unknown) {
      this.logger.error(`Failed to fetch Universalis prices: ${(err as Error).message}`, (err as Error).stack);
    }

    return priceMap;
  }

  private extractPrice(item: UniversalisItemPrice): number | null {
    // Prefer minPriceNQ (NQ minimum price on market board), then minPrice, then average NQ
    const raw = item.minPriceNQ ?? item.minPrice ?? item.currentAveragePriceNQ ?? item.currentAveragePrice;
    if (raw === undefined || raw === null || Number.isNaN(raw)) return null;
    return Math.round(raw);
  }
}
