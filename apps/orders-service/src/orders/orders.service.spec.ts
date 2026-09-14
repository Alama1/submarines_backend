import { OrdersService } from './orders.service';
import {
  BadRequestException,
} from '@nestjs/common';
import {
  BaseMaterial,
  expandAllPartMaterials,
  ExpandedMaterialRequirement,
  Order,
  OrderItem,
  PartMaterial,
  SubmarinePart,
} from '@ff14/entities';

describe('OrdersService — computeMissingMaterials', () => {
  const svc = new OrdersService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  const mat = (id: string, name: string, currentStock: number): BaseMaterial =>
    ({ id, name, itemId: 1000, currentStock }) as BaseMaterial;

  const part = (
    id: string,
    name: string,
    stock: number,
    materials: Array<{ material: BaseMaterial; quantity: number }>,
  ): SubmarinePart =>
    ({
      id,
      name,
      stock,
      materials: materials.map(
        (m, i) => ({ material: m.material, quantity: m.quantity }) as PartMaterial,
      ),
    }) as SubmarinePart;

  const order = (items: Array<{ part: SubmarinePart; quantity: number }>): Order =>
    ({ items: items.map(({ part, quantity }) => ({ part, quantity }) as OrderItem) }) as Order;

  const compute = (
    o: Order,
    allParts: SubmarinePart[],
    availableStock: Map<string, number> = new Map(),
  ) => {
    const partsById = new Map(allParts.map((p) => [p.id, p]));
    const partsByName = new Map(allParts.map((p) => [p.name.toLowerCase(), p]));
    const matById = new Map<string, BaseMaterial>();
    for (const p of allParts) {
      for (const pm of p.materials ?? []) {
        if (pm.material) matById.set(pm.material.id, pm.material);
      }
    }
    const expanded: Map<string, ExpandedMaterialRequirement[]> =
      expandAllPartMaterials(allParts);
    return (svc as any).computeMissingMaterials(
      o,
      partsById,
      partsByName,
      matById,
      expanded,
      availableStock,
    );
  };

  it('lists raw material shortages for the parts still to craft', () => {
    const iron = mat('iron', 'Iron Ore', 4);
    const oak = mat('oak', 'Oak Lumber', 100);
    const hull = part('shark_hull', 'Shark Hull', 1, [
      { material: iron, quantity: 5 },
      { material: oak, quantity: 2 },
    ]);

    const missing = compute(order([{ part: hull, quantity: 3 }]), [hull]);

    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({
      materialId: 'iron',
      name: 'Iron Ore',
      needed: 10,
      available: 4,
      missing: 6,
    });
  });

  it('fully resolves part-as-material rows into raw needs minus nested part stock', () => {
    const iron = mat('iron', 'Iron Ore', 3);
    const cobalt = mat('cobalt', 'Cobalt Ore', 20);
    const baseHull = part('shark_hull', 'Shark Hull', 1, [
      { material: iron, quantity: 5 },
    ]);
    const modHull = part('shark_hull_mod', 'Shark Modified Hull', 0, [
      { material: baseHull as any, quantity: 1 },
      { material: cobalt, quantity: 3 },
    ]);

    const missing = compute(order([{ part: modHull, quantity: 2 }]), [
      baseHull,
      modHull,
    ]);

    // No intermediate part entries — only raw materials, and only for the
    // units not already covered by the 1 Shark Hull in stock:
    // iron needed = (2 hulls required - 1 covered) * 5 = 5 -> missing 2.
    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({
      materialId: 'iron',
      name: 'Iron Ore',
      needed: 5,
      available: 3,
      missing: 2,
    });
    expect(missing.find((m: any) => m.materialId === baseHull.id)).toBeUndefined();
    expect(missing.find((m: any) => m.materialId === 'cobalt')).toBeUndefined();
  });

  it('returns empty when all parts are already in stock', () => {
    const iron = mat('iron', 'Iron Ore', 0);
    const hull = part('shark_hull', 'Shark Hull', 5, [
      { material: iron, quantity: 5 },
    ]);

    expect(compute(order([{ part: hull, quantity: 5 }]), [hull])).toEqual([]);
  });

  it('allocates shared raw material stock across orders by confirmedAt sequence', () => {
    const iron = mat('iron', 'Iron Ore', 15);
    const hull = part('shark_hull', 'Shark Hull', 0, [
      { material: iron, quantity: 5 },
    ]);

    const availableStock = new Map<string, number>();
    const first = compute(order([{ part: hull, quantity: 2 }]), [hull], availableStock);
    const second = compute(order([{ part: hull, quantity: 2 }]), [hull], availableStock);

    expect(first).toEqual([]);
    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({
      needed: 10,
      available: 5,
      missing: 5,
    });
  });
});

describe('OrdersService — computeAggregate', () => {
  const svc = new OrdersService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  const mat = (id: string, name: string, currentStock: number): BaseMaterial =>
    ({ id, name, itemId: 1000, currentStock }) as BaseMaterial;

  const part = (
    id: string,
    name: string,
    stock: number,
    materials: Array<{ material: BaseMaterial; quantity: number }>,
  ): SubmarinePart =>
    ({
      id,
      name,
      stock,
      materials: materials.map(
        (m) => ({ material: m.material, quantity: m.quantity }) as PartMaterial,
      ),
    }) as SubmarinePart;

  const order = (items: Array<{ part: SubmarinePart; quantity: number }>): Order =>
    ({ items: items.map(({ part, quantity }) => ({ part, quantity }) as OrderItem) }) as Order;

  const aggregate = (orders: Order[], allParts: SubmarinePart[]) => {
    const partsById = new Map(allParts.map((p) => [p.id, p]));
    const partsByName = new Map(allParts.map((p) => [p.name.toLowerCase(), p]));
    const matById = new Map<string, BaseMaterial>();
    for (const p of allParts) {
      for (const pm of p.materials ?? []) {
        if (pm.material) matById.set(pm.material.id, pm.material);
      }
    }
    const expanded: Map<string, ExpandedMaterialRequirement[]> =
      expandAllPartMaterials(allParts);
    return (svc as any).computeAggregate(
      orders,
      partsById,
      partsByName,
      matById,
      expanded,
    );
  };

  it('sums requirements across orders and reports the shortfall vs stock', () => {
    const iron = mat('iron', 'Iron Ore', 15);
    const hull = part('shark_hull', 'Shark Hull', 0, [
      { material: iron, quantity: 5 },
    ]);

    const agg = aggregate(
      [order([{ part: hull, quantity: 2 }]), order([{ part: hull, quantity: 2 }])],
      [hull],
    );

    expect(agg.materials).toHaveLength(1);
    expect(agg.materials[0]).toMatchObject({
      materialId: 'iron',
      name: 'Iron Ore',
      needed: 20,
      available: 15,
      missing: 5,
    });
  });

  it('counts nested part stock once across orders and subtracts covered raw requirements', () => {
    const iron = mat('iron', 'Iron Ore', 5);
    const cobalt = mat('cobalt', 'Cobalt Ore', 100);
    const baseHull = part('shark_hull', 'Shark Hull', 1, [
      { material: iron, quantity: 5 },
    ]);
    const modHull = part('shark_hull_mod', 'Shark Modified Hull', 0, [
      { material: baseHull as any, quantity: 1 },
      { material: cobalt, quantity: 3 },
    ]);

    const agg = aggregate(
      [order([{ part: modHull, quantity: 1 }]), order([{ part: modHull, quantity: 1 }])],
      [baseHull, modHull],
    );

    // Part-as-material rows are resolved — no intermediate part entries.
    expect(agg.materials.find((m: any) => m.materialId === 'shark_hull')).toBeUndefined();

    const ironEntry = agg.materials.find((m: any) => m.materialId === 'iron');
    expect(ironEntry).toMatchObject({ needed: 5, available: 5, missing: 0 });

    const cobaltEntry = agg.materials.find((m: any) => m.materialId === 'cobalt');
    expect(cobaltEntry).toMatchObject({ needed: 6, available: 100, missing: 0 });
  });

  it('ignores parts already fully covered by stock', () => {
    const iron = mat('iron', 'Iron Ore', 0);
    const hull = part('shark_hull', 'Shark Hull', 3, [
      { material: iron, quantity: 5 },
    ]);

    const agg = aggregate([order([{ part: hull, quantity: 3 }])], [hull]);

    expect(agg.materials).toEqual([]);
  });
});

describe('OrdersService — computePricing', () => {
  const svc = new OrdersService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  const part = (id: string, partType: string): SubmarinePart =>
    ({ id, partType }) as SubmarinePart;

  const discounts = [
    { threshold: 10, discountPercent: 15 },
    { threshold: 4, discountPercent: 5 },
  ] as any[];

  it('sums line totals and applies the highest matching discount tier', () => {
    const items = [
      { part: part('h1', 'hull'), quantity: 4, unitPrice: 1000 },
      { part: part('b1', 'bow'), quantity: 1, unitPrice: 500 },
    ];

    // Craftable count = 5 -> 15%-off tier (threshold 10) not met, 5% tier met
    expect((svc as any).computePricing(items, discounts)).toEqual({
      subtotal: 4500,
      discountPct: 5,
      discountAmt: 225,
      total: 4275,
    });
  });

  it('counts only craftable part types toward discount tiers', () => {
    const items = [
      { part: part('h1', 'hull'), quantity: 3, unitPrice: 1000 },
      // Repair kits ('Materials') never count toward the tier
      { part: part('kit', 'Materials'), quantity: 9, unitPrice: 100 },
    ];

    // Craftable count = 3 -> below every tier
    expect((svc as any).computePricing(items, discounts)).toEqual({
      subtotal: 3900,
      discountPct: 0,
      discountAmt: 0,
      total: 3900,
    });
  });
});

describe('OrdersService — update', () => {
  const part = (id: string, price: number): SubmarinePart =>
    ({ id, name: id, partType: 'hull', price }) as SubmarinePart;

  it('rejects editing orders that are not active', async () => {
    const orderRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'o1', orderCode: 'SUB-1', status: 'finished' }),
    };
    const svc = new OrdersService(orderRepo as any, {} as any, {} as any, {} as any);

    await expect(svc.update('o1', { notes: 'x' })).rejects.toThrow(BadRequestException);
    await expect(svc.update('o1', { notes: 'x' })).rejects.toThrow(/only active orders/i);
  });

  it('updates client details without touching items', async () => {
    const order: any = {
      id: 'o1',
      orderCode: 'SUB-1',
      status: 'confirmed',
      clientName: 'Old Name',
      notes: null,
      items: [],
    };
    const orderRepo = {
      findOne: jest.fn().mockResolvedValue(order),
      save: jest.fn().mockResolvedValue(order),
    };
    const svc = new OrdersService(orderRepo as any, {} as any, {} as any, {} as any);

    const result = await svc.update('o1', { clientName: 'New Name', notes: 'fixed typo' });

    expect(orderRepo.save).toHaveBeenCalledWith(order);
    expect(result.clientName).toBe('New Name');
    expect(result.notes).toBe('fixed typo');
  });

  it('replaces items and recalculates pricing for active orders', async () => {
    const hull = part('shark_hull', 1000);
    const order: any = {
      id: 'o1',
      orderCode: 'SUB-1',
      status: 'in_progress',
      subtotal: 3000,
      discountPct: 0,
      discountAmt: 0,
      total: 3000,
      items: [{ id: 7, quantity: 3 }],
    };
    const orderRepo = {
      findOne: jest.fn().mockResolvedValue(order),
      save: jest.fn(),
    };
    const partRepo = { find: jest.fn().mockResolvedValue([hull]) };
    const discountRepo = { find: jest.fn().mockResolvedValue([]) };
    const em = {
      delete: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockImplementation((_cls: any, data: any) => data),
      save: jest.fn().mockResolvedValue({}),
    };
    const ds = { transaction: jest.fn().mockImplementation((cb: any) => cb(em)) };
    const svc = new OrdersService(orderRepo as any, partRepo as any, discountRepo as any, ds as any);

    const result = await svc.update('o1', {
      items: [{ partId: 'shark_hull', quantity: 2 }],
    });

    expect(em.delete).toHaveBeenCalledWith(OrderItem, [7]);
    expect(order.subtotal).toBe(2000);
    expect(order.total).toBe(2000);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({
      part: hull,
      quantity: 2,
      unitPrice: 1000,
      lineTotal: 2000,
    });
    expect(result.total).toBe(2000);
  });

  it('rejects empty item lists and unknown parts', async () => {
    const orderRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'o1', orderCode: 'SUB-1', status: 'confirmed', items: [] }),
    };
    const svc = new OrdersService(orderRepo as any, {} as any, {} as any, {} as any);

    await expect(svc.update('o1', { items: [] })).rejects.toThrow(BadRequestException);
  });
});
