import { OrdersService } from './orders.service';
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
      isPart: false,
    });
  });

  it('reports part-as-material requirements and subtracts nested part stock from raw needs', () => {
    const iron = mat('iron', 'Iron Ore', 50);
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

    const partEntry = missing.find((m: any) => m.materialId === baseHull.id);
    expect(partEntry).toMatchObject({
      name: 'Shark Hull',
      needed: 2,
      available: 1,
      missing: 1,
      isPart: true,
    });

    const ironEntry = missing.find((m: any) => m.materialId === 'iron');
    expect(ironEntry).toBeUndefined();

    const cobaltEntry = missing.find((m: any) => m.materialId === 'cobalt');
    expect(cobaltEntry).toBeUndefined();

    expect(missing).toHaveLength(1);
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
      isPart: false,
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

    const partEntry = agg.materials.find((m: any) => m.materialId === 'shark_hull');
    expect(partEntry).toMatchObject({
      needed: 2,
      available: 1,
      missing: 1,
      isPart: true,
    });

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
