import { Controller, Inject, Logger, Optional } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { BaseMaterial } from '@ff14/entities';

export interface ReserveRequestItem {
  materialId: string;
  quantity: number;
}

export interface ReserveRequestPayload {
  orderId: string;
  items: ReserveRequestItem[];
}

export interface ReserveMissingItem {
  materialId: string;
  name: string;
  required: number;
  available: number;
}

export interface ReserveResponse {
  status: 'reserved' | 'insufficient' | 'error';
  orderId: string;
  missing?: ReserveMissingItem[];
  error?: string;
}

@Controller()
export class ReserveConsumer {
  private readonly logger = new Logger(ReserveConsumer.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Optional() @Inject(CACHE_MANAGER) private readonly cache?: Cache,
  ) {}

  @MessagePattern('inventory.reserve')
  async handleReserve(@Payload() data: ReserveRequestPayload): Promise<ReserveResponse> {
    const { orderId, items } = data;
    this.logger.log(`Received inventory.reserve request for order "${orderId}" with ${items?.length ?? 0} material requirements`);

    if (!items?.length) {
      return { status: 'reserved', orderId };
    }

    try {
      const result = await this.dataSource.transaction(async (em) => {
        const missing: ReserveMissingItem[] = [];
        const materialsToUpdate: { material: BaseMaterial; newStock: number }[] = [];

        for (const req of items) {
          const mat = await em.findOne(BaseMaterial, {
            where: { id: req.materialId },
            // Pessimistic write lock to prevent race conditions during reservation
            lock: { mode: 'pessimistic_write' },
          });

          if (!mat) {
            missing.push({
              materialId: req.materialId,
              name: 'Unknown Material',
              required: req.quantity,
              available: 0,
            });
            continue;
          }

          if (mat.currentStock < req.quantity) {
            missing.push({
              materialId: mat.id,
              name: mat.name,
              required: req.quantity,
              available: mat.currentStock,
            });
          } else {
            materialsToUpdate.push({
              material: mat,
              newStock: mat.currentStock - req.quantity,
            });
          }
        }

        if (missing.length > 0) {
          this.logger.warn(`Order "${orderId}" cannot be reserved. Missing ${missing.length} materials.`);
          return { status: 'insufficient' as const, orderId, missing };
        }

        // All materials are sufficient -> decrement stock
        for (const item of materialsToUpdate) {
          item.material.currentStock = item.newStock;
          await em.save(item.material);
        }

        this.logger.log(`Order "${orderId}" successfully reserved ${materialsToUpdate.length} materials.`);
        return { status: 'reserved' as const, orderId };
      });

      if (result.status === 'reserved' && this.cache) {
        try {
          await this.cache.reset();
        } catch {
        }
      }

      return result;
    } catch (err: unknown) {
      this.logger.error(`Error processing inventory.reserve for order "${orderId}": ${(err as Error).message}`, (err as Error).stack);
      return { status: 'error', orderId, error: (err as Error).message };
    }
  }
}
