import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { BaseMaterial } from '@ff14/entities';
import { UniversalisClient } from '../universalis/universalis.client';

@Injectable()
export class PriceRefreshJob {
  private readonly logger = new Logger(PriceRefreshJob.name);
  private isRunning = false;

  constructor(
    @InjectRepository(BaseMaterial)
    private readonly materialRepo: Repository<BaseMaterial>,
    private readonly universalis: UniversalisClient,
    @Optional() @Inject(CACHE_MANAGER) private readonly cache?: Cache,
  ) {}

  /** Runs every 5 minutes by default */
  @Cron('0 */5 * * * *')
  async handleCron(): Promise<void> {
    this.logger.log('Starting scheduled Universalis price refresh...');
    await this.runRefresh();
  }

  /** RabbitMQ message pattern to trigger a price refresh on demand */
  @MessagePattern('universalis_price_refresh')
  async handleMessage(@Payload() data?: { force?: boolean }): Promise<{ success: boolean; updatedCount: number }> {
    this.logger.log(`Received manual price refresh request (force: ${data?.force ?? false})`);
    const count = await this.runRefresh();
    return { success: true, updatedCount: count };
  }

  async runRefresh(): Promise<number> {
    if (this.isRunning) {
      this.logger.warn('Price refresh is already in progress, skipping run.');
      return 0;
    }

    this.isRunning = true;
    let updatedCount = 0;

    try {
      // 1. Fetch all materials that have a valid Universalis itemId
      const materials = await this.materialRepo
        .createQueryBuilder('m')
        .where('m.item_id IS NOT NULL')
        .getMany();

      if (!materials.length) {
        this.logger.log('No materials with itemId found, nothing to refresh.');
        return 0;
      }

      this.logger.log(`Found ${materials.length} materials with itemId to sync.`);

      // 2. Batch item IDs into chunks of 50
      const chunkSize = 50;
      const chunks: BaseMaterial[][] = [];
      for (let i = 0; i < materials.length; i += chunkSize) {
        chunks.push(materials.slice(i, i + chunkSize));
      }

      for (const chunk of chunks) {
        const itemIds = chunk
          .map((m) => m.itemId)
          .filter((id): id is number => id !== null && id > 0);

        if (!itemIds.length) continue;

        const priceMap = await this.universalis.fetchMarketPrices(itemIds);

        for (const mat of chunk) {
          if (mat.itemId && priceMap.has(mat.itemId)) {
            const newMarketPrice = priceMap.get(mat.itemId)!;
            if (mat.marketPrice !== newMarketPrice) {
              mat.marketPrice = newMarketPrice;
              await this.materialRepo.save(mat);
              updatedCount++;
            }
          }
        }
      }

      this.logger.log(`Universalis price refresh complete. Updated ${updatedCount} material prices.`);

      // 3. Invalidate Redis cache if available
      if (this.cache) {
        try {
          await this.cache.reset();
        } catch (cacheErr: unknown) {
          this.logger.warn(`Failed to clear cache: ${(cacheErr as Error).message}`);
        }
      }
    } catch (err: unknown) {
      this.logger.error(`Error during Universalis price refresh: ${(err as Error).message}`, (err as Error).stack);
    } finally {
      this.isRunning = false;
    }

    return updatedCount;
  }
}
