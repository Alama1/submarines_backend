import { AboutService } from './about.service';
import { BaseMaterial, Order, OrderItem } from '@ff14/entities';

describe('AboutService — getStats', () => {
  const buildSvc = (orders: Order[], materials: BaseMaterial[] = []): AboutService => {
    const orderRepo = { find: jest.fn().mockResolvedValue(orders) };
    const ds = {
      getRepository: jest.fn().mockReturnValue({
        find: jest.fn().mockResolvedValue(materials),
      }),
    };
    return new AboutService(orderRepo as any, ds as any);
  };

  const order = (data: Partial<Order>, items: Partial<OrderItem>[] = []): Order =>
    ({
      status: 'pending',
      clientName: '',
      isAnonymous: false,
      discountAmt: 0,
      total: 0,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-02T00:00:00Z'),
      items: items.map((i) => i as OrderItem),
      ...data,
    }) as Order;

  const item = (data: Partial<OrderItem>): Partial<OrderItem> => ({
    partName: 'Shark Hull',
    partType: 'hull',
    quantity: 1,
    buildName: null,
    ...data,
  });

  const material = (data: Partial<BaseMaterial>): BaseMaterial =>
    ({
      currentStock: 0,
      marketPrice: null,
      myPrice: null,
      npcPrice: null,
      ...data,
    }) as BaseMaterial;

  it('sums fulfilled figures and revenue, skipping cancelled orders', async () => {
    const svc = buildSvc([
      order(
        {
          status: 'fulfilled',
          clientName: 'Alice',
          total: 5000,
          discountAmt: 250,
          createdAt: new Date('2025-03-01T00:00:00Z'),
          updatedAt: new Date('2025-03-05T00:00:00Z'),
        },
        [item({ partType: 'hull', quantity: 2 }), item({ partType: 'bow', quantity: 2 })],
      ),
      order({ status: 'cancelled' }, [item({ partType: 'hull', quantity: 50 })]),
    ]);

    const stats = await svc.getStats();

    expect(stats.orders.fulfilled).toBe(1);
    expect(stats.orders.total).toBe(1);
    expect(stats.orders.revenue).toBe(5000);
    expect(stats.orders.discountsGiven).toBe(250);
    expect(stats.orders.uniqueClients).toBe(1);
    expect(stats.crafting.fulfilledParts).toBe(4);
    expect(stats.crafting.allTimeParts).toBe(4);
    expect(stats.orders.byStatus.cancelled).toBe(1);
  });

  it('ignores non-craftable items in part counts', async () => {
    const svc = buildSvc([
      order({ status: 'fulfilled' }, [
        item({ partType: 'hull', quantity: 3 }),
        item({ partName: 'Rank 2 Materials', partType: 'Materials', quantity: 7 }),
      ]),
    ]);

    const stats = await svc.getStats();

    expect(stats.crafting.fulfilledParts).toBe(3);
  });

  it('counts active order parts separately from all-time parts', async () => {
    const svc = buildSvc([
      order({ status: 'in_progress' }, [item({ partType: 'stern', quantity: 5 })]),
      order({ status: 'finished' }, [item({ partType: 'bridge', quantity: 2 })]),
      order({ status: 'pending' }, [item({ partType: 'hull', quantity: 3 })]),
    ]);

    const stats = await svc.getStats();

    expect(stats.crafting.activeParts).toBe(7);
    expect(stats.crafting.allTimeParts).toBe(10);
    expect(stats.crafting.fulfilledParts).toBe(0);
    expect(stats.orders.active).toBe(2);
  });

  it('deduplicates clients case-insensitively and skips anonymous ones', async () => {
    const svc = buildSvc([
      order({ status: 'fulfilled', clientName: 'Alice' }),
      order({ status: 'fulfilled', clientName: '  alice ' }),
      order({ status: 'fulfilled', clientName: 'Bob' }),
      order({ status: 'fulfilled', clientName: '', isAnonymous: true }),
    ]);

    const stats = await svc.getStats();

    expect(stats.orders.uniqueClients).toBe(2);
  });

  it('tracks the first and last order dates across all statuses', async () => {
    const svc = buildSvc([
      order({ status: 'fulfilled', createdAt: new Date('2025-05-01T00:00:00Z') }),
      order({ status: 'cancelled', createdAt: new Date('2024-01-15T00:00:00Z') }),
      order({ status: 'pending', createdAt: new Date('2025-08-20T00:00:00Z') }),
    ]);

    const stats = await svc.getStats();

    expect(stats.tracking.firstOrderAt).toBe('2024-01-15T00:00:00.000Z');
    expect(stats.tracking.lastOrderAt).toBe('2025-08-20T00:00:00.000Z');
  });

  it('ranks the top fulfilled parts by crafted quantity', async () => {
    const svc = buildSvc([
      order({ status: 'fulfilled' }, [
        item({ partName: 'Shark Hull', partType: 'hull', quantity: 2 }),
        item({ partName: 'Shark Stern', partType: 'stern', quantity: 1 }),
      ]),
      order({ status: 'fulfilled' }, [
        item({ partName: 'Shark Hull', partType: 'hull', quantity: 4 }),
      ]),
      order({ status: 'in_progress' }, [
        item({ partName: 'Syldra Bow', partType: 'bow', quantity: 99 }),
      ]),
    ]);

    const stats = await svc.getStats();

    expect(stats.topParts).toEqual([
      { name: 'Shark Hull', quantity: 6 },
      { name: 'Shark Stern', quantity: 1 },
    ]);
  });

  it('values pre-crafts as the average of universalis and my-price valuations', async () => {
    const svc = buildSvc([], [
      material({ currentStock: 10, marketPrice: 100, myPrice: 60 }),
      // myPrice missing — falls back to market price for the "my" valuation
      material({ currentStock: 5, marketPrice: 40 }),
      // npc-only material has no universalis price, but counts via effective price
      material({ currentStock: 8, npcPrice: 25 }),
      material({ currentStock: 0, marketPrice: 99999, myPrice: 99999 }),
    ]);

    const stats = await svc.getStats();

    // marketWorth = 10*100 + 5*40 + 8*0  = 1200
    // myWorth     = 10*60  + 5*40 + 8*25 = 1000
    expect(stats.precrafts.marketWorth).toBe(1200);
    expect(stats.precrafts.myWorth).toBe(1000);
    expect(stats.precrafts.worth).toBe(1100);
  });

  it('handles an empty database without errors', async () => {
    const svc = buildSvc([]);

    const stats = await svc.getStats();

    expect(stats.tracking.firstOrderAt).toBeNull();
    expect(stats.orders.fulfilled).toBe(0);
    expect(stats.crafting.fulfilledParts).toBe(0);
    expect(stats.precrafts.worth).toBe(0);
    expect(stats.topParts).toEqual([]);
  });
});
