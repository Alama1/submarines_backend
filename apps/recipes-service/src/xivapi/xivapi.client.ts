import { Injectable, Logger } from '@nestjs/common';

interface XivApiSearchResult {
  row_id: number;
  fields?: {
    Name?: string;
    ID?: number;
  };
}

interface XivApiSearchResponse {
  results?: XivApiSearchResult[];
  next?: string;
  previous?: string;
}

@Injectable()
export class XivApiClient {
  private readonly logger = new Logger(XivApiClient.name);
  private readonly baseUrl = 'https://v2.xivapi.com/api/search';

  /**
   * Resolves the in-game item ID for an item name via the XIVAPI v2 search
   * endpoint (sheet "Item"). Mirrors the original "fetchAndSetIds" Sheets
   * logic: query `Name~"<name>"` with limit 1 and take the first result's
   * row_id. Returns null when nothing matches or the request fails.
   */
  async searchItemId(name: string): Promise<number | null> {
    const url =
      `${this.baseUrl}?sheets=Item&language=en&limit=1&fields=Name,ID` +
      `&query=${encodeURIComponent(`Name~"${name}"`)}`;

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'FF14-Submarines-Backend/1.0' },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        this.logger.warn(`XIVAPI search returned HTTP ${res.status} for "${name}"`);
        return null;
      }

      const data = (await res.json()) as XivApiSearchResponse;
      const first = data.results?.[0];
      if (!first) {
        this.logger.debug(`XIVAPI search found no match for "${name}"`);
        return null;
      }

      return first.row_id;
    } catch (err: unknown) {
      this.logger.error(
        `XIVAPI search failed for "${name}": ${(err as Error).message}`,
        (err as Error).stack,
      );
      return null;
    }
  }
}
