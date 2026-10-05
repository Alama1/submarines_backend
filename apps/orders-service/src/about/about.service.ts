import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseMaterial, Order, OrderStatus } from '@ff14/entities';

export interface AboutStats {
  generatedAt: string;
  tracking: {
    firstOrderAt: string | null;
    lastOrderAt: string | null;
    lastFulfilledAt: string | null;
  };
  orders: {
    total: number;
    byStatus: Record<OrderStatus, number>;
    active: number;
    fulfilled: number;
    uniqueClients: number;
    revenue: number;
    discountsGiven: number;
  };
  crafting: {
    fulfilledParts: number;
    activeParts: number;
    allTimeParts: number;
  };
  precrafts: {
    marketWorth: number;
    myWorth: number;
    worth: number;
  };
  fulfillmentTime: {
    orderCount: number;
    p25Ms: number;
    medianMs: number;
    p75Ms: number;
    p90Ms: number;
    avgMs: number;
  } | null;
  topParts: Array<{ name: string; quantity: number }>;
}

@Injectable()
export class AboutService {
  private static readonly CRAFTABLE_PART_TYPES = new Set(['bow', 'bridge', 'hull', 'stern']);

  private static readonly STATUSES: OrderStatus[] = [
    'pending',
    'confirmed',
    'in_progress',
    'finished',
    'fulfilled',
    'cancelled',
  ];

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectDataSource()
    private readonly ds: DataSource,
  ) {}

  private effectivePriceOf(mat: BaseMaterial): number {
    return mat.myPrice ?? mat.marketPrice ?? mat.npcPrice ?? 0;
  }

  /** Continuous percentile (same interpolation as Postgres percentile_cont). */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }

  async getStats(): Promise<AboutStats> {
    const [orders, materials] = await Promise.all([
      this.orderRepo.find(),
      this.ds.getRepository(BaseMaterial).find(),
    ]);

    const byStatus = Object.fromEntries(
      AboutService.STATUSES.map((s) => [s, 0]),
    ) as Record<OrderStatus, number>;

    let firstOrderAt: Date | null = null;
    let lastOrderAt: Date | null = null;
    let lastFulfilledAt: Date | null = null;

    let fulfilledOrders = 0;
    let activeOrders = 0;
    let revenue = 0;
    let discountsGiven = 0;

    let fulfilledParts = 0;
    let activeParts = 0;
    let allTimeParts = 0;

    const clients = new Set<string>();
    const partQuantity = new Map<string, number>();
    const fulfillmentDurations: number[] = [];

    const isCraftable = (partType: string | null | undefined): boolean =>
      AboutService.CRAFTABLE_PART_TYPES.has((partType ?? '').toLowerCase());

    for (const order of orders) {
      for (const status of AboutService.STATUSES) {
        if (order.status === status) byStatus[status]++;
      }

      if (!firstOrderAt || order.createdAt < firstOrderAt) firstOrderAt = order.createdAt;
      if (!lastOrderAt || order.createdAt > lastOrderAt) lastOrderAt = order.createdAt;

      // Distinct non-anonymous clients across all real (non-cancelled) orders
      if (order.status !== 'cancelled' && !order.isAnonymous && order.clientName?.trim()) {
        clients.add(order.clientName.trim().toLowerCase());
      }

      const isActive =
        order.status === 'confirmed' ||
        order.status === 'in_progress' ||
        order.status === 'finished';

      if (isActive) activeOrders++;

      if (order.status === 'fulfilled') {
        fulfilledOrders++;
        revenue += order.total;
        discountsGiven += order.discountAmt;
        fulfillmentDurations.push(order.updatedAt.getTime() - order.createdAt.getTime());
        if (!lastFulfilledAt || order.updatedAt > lastFulfilledAt) {
          lastFulfilledAt = order.updatedAt;
        }
      }

      // Cancelled orders never happened — excluded from every crafting figure
      if (order.status === 'cancelled') continue;

      for (const item of order.items ?? []) {
        if (!isCraftable(item.partType)) continue;
        allTimeParts += item.quantity;
        if (isActive) activeParts += item.quantity;
        if (order.status === 'fulfilled') {
          fulfilledParts += item.quantity;
          partQuantity.set(
            item.partName,
            (partQuantity.get(item.partName) ?? 0) + item.quantity,
          );
        }
      }
    }

    // Worth of everything currently pre-crafted in stock, valued two ways
    // (same formulas as the inventory service net-worth endpoint)
    let marketWorth = 0;
    let myWorth = 0;
    for (const mat of materials) {
      if (mat.currentStock <= 0) continue;
      marketWorth += mat.currentStock * (mat.marketPrice ?? 0);
      myWorth += mat.currentStock * this.effectivePriceOf(mat);
    }

    const topParts = [...partQuantity.entries()]
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name))
      .slice(0, 5);

    // How long past orders took from creation to handover
    let fulfillmentTime: AboutStats['fulfillmentTime'] = null;
    if (fulfillmentDurations.length > 0) {
      const sorted = [...fulfillmentDurations].sort((a, b) => a - b);
      fulfillmentTime = {
        orderCount: sorted.length,
        p25Ms: Math.round(this.percentile(sorted, 0.25)),
        medianMs: Math.round(this.percentile(sorted, 0.5)),
        p75Ms: Math.round(this.percentile(sorted, 0.75)),
        p90Ms: Math.round(this.percentile(sorted, 0.9)),
        avgMs: Math.round(
          sorted.reduce((sum, d) => sum + d, 0) / sorted.length,
        ),
      };
    }

    return {
      generatedAt: new Date().toISOString(),
      tracking: {
        firstOrderAt: firstOrderAt?.toISOString() ?? null,
        lastOrderAt: lastOrderAt?.toISOString() ?? null,
        lastFulfilledAt: lastFulfilledAt?.toISOString() ?? null,
      },
      orders: {
        total: orders.length - byStatus.cancelled,
        byStatus,
        active: activeOrders,
        fulfilled: fulfilledOrders,
        uniqueClients: clients.size,
        revenue,
        discountsGiven,
      },
      crafting: {
        fulfilledParts,
        activeParts,
        allTimeParts,
      },
      precrafts: {
        marketWorth,
        myWorth,
        worth: Math.round((marketWorth + myWorth) / 2),
      },
      fulfillmentTime,
      topParts,
    };
  }
}
