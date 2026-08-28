import { Controller, Inject, Logger } from '@nestjs/common';
import { EventPattern, Payload, ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom, timeout } from 'rxjs';
import { Order, OrderItem, SubmarinePart, PartMaterial } from '@ff14/entities';

export interface OrderProcessingPayload {
  orderId: string;
}

export interface ReserveResponse {
  status: 'reserved' | 'insufficient' | 'error';
  orderId: string;
  missing?: Array<{
    materialId: string;
    name: string;
    required: number;
    available: number;
  }>;
  error?: string;
}

@Controller()
export class OrderProcessingConsumer {
  private readonly logger = new Logger(OrderProcessingConsumer.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(SubmarinePart)
    private readonly partRepo: Repository<SubmarinePart>,
    @Inject('INVENTORY_RMQ_CLIENT')
    private readonly inventoryClient: ClientProxy,
  ) {}

  @EventPattern('order_processing')
  async handleOrderProcessing(@Payload() data: OrderProcessingPayload): Promise<void> {
    const { orderId } = data;
    this.logger.log(`Starting processing for order "${orderId}"...`);

    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'items.part'],
    });

    if (!order) {
      this.logger.error(`Order "${orderId}" not found in database`);
      return;
    }

    if (order.status !== 'pending') {
      this.logger.warn(`Order "${orderId}" is already in "${order.status}" status, skipping processing`);
      return;
    }

    // 1. Update status to processing
    order.status = 'processing';
    await this.orderRepo.save(order);

    try {
      // 2. Build aggregated material requirements
      // For each item in order, load its SubmarinePart materials and multiply by order quantity
      const materialMap = new Map<string, number>(); // materialId -> totalRequired

      for (const item of order.items) {
        if (!item.part) {
          // If part entity relation is missing, look up by partName / id
          continue;
        }

        const partWithMaterials = await this.partRepo.findOne({
          where: { id: item.part.id },
          relations: ['materials', 'materials.material'],
        });

        if (partWithMaterials?.materials) {
          for (const pm of partWithMaterials.materials) {
            if (!pm.material) continue;
            const matId = pm.material.id;
            const requiredForThisPart = pm.quantity * item.quantity;
            const currentTotal = materialMap.get(matId) ?? 0;
            materialMap.set(matId, currentTotal + requiredForThisPart);
          }
        }
      }

      const reserveItems = Array.from(materialMap.entries()).map(([materialId, quantity]) => ({
        materialId,
        quantity,
      }));

      this.logger.log(`Order "${orderId}" requires ${reserveItems.length} unique base materials.`);

      // 3. Send reserve request to inventory-worker
      let reserveResult: ReserveResponse;
      try {
        reserveResult = await firstValueFrom(
          this.inventoryClient
            .send<ReserveResponse>('inventory.reserve', {
              orderId: order.id,
              items: reserveItems,
            })
            .pipe(timeout(10000)),
        );
      } catch (err: unknown) {
        this.logger.error(`Failed to reach inventory-worker for order "${orderId}": ${(err as Error).message}`);
        order.notes = (order.notes ? order.notes + '\n' : '') + `Processing error: ${(err as Error).message}`;
        await this.orderRepo.save(order);
        return;
      }

      // 4. Update order status based on reservation result
      if (reserveResult.status === 'reserved') {
        order.status = 'fulfilled';
        this.logger.log(`Order "${orderId}" successfully fulfilled.`);
      } else if (reserveResult.status === 'insufficient') {
        order.status = 'cancelled';
        const missingDetails = (reserveResult.missing ?? [])
          .map((m) => `${m.name} (need: ${m.required}, have: ${m.available})`)
          .join(', ');
        const cancelNote = `Cancelled automatically: Insufficient stock. Missing: ${missingDetails}`;
        order.notes = order.notes ? `${order.notes}\n${cancelNote}` : cancelNote;
        this.logger.warn(`Order "${orderId}" cancelled due to insufficient inventory: ${missingDetails}`);
      } else {
        this.logger.error(`Order "${orderId}" encountered reserve error: ${reserveResult.error}`);
        order.notes = (order.notes ? order.notes + '\n' : '') + `Reserve error: ${reserveResult.error}`;
      }

      await this.orderRepo.save(order);
    } catch (err: unknown) {
      this.logger.error(`Unexpected error processing order "${orderId}": ${(err as Error).message}`, (err as Error).stack);
      order.notes = (order.notes ? order.notes + '\n' : '') + `Error: ${(err as Error).message}`;
      await this.orderRepo.save(order);
    }
  }
}
