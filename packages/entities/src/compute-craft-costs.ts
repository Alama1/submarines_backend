import { BaseMaterial } from './base-material.entity';

export interface MaterialCostInfo {
  /**
   * Total cost to craft this material from its own recipe
   * (0 when the material has no recipe / is not craftable).
   */
  craftCost: number;
  /**
   * True when some ingredient in the chain has no usable price source
   * (no myPrice/marketPrice/npcPrice), i.e. the craft cost may be understated.
   */
  incomplete: boolean;
}

export function effectivePriceOf(mat: BaseMaterial): number {
  return mat.myPrice ?? mat.marketPrice ?? mat.npcPrice ?? 0;
}

/**
 * Computes craft costs for all materials, resolving multi-tier recipes
 * recursively. Crafted ingredients are valued at min(buy price, their own
 * craft cost); raw ingredients at their effective price.
 * Cycle-safe and memoized.
 */
export function computeCraftCosts(
  matById: Map<string, BaseMaterial>,
): Map<string, MaterialCostInfo> {
  const memo = new Map<string, MaterialCostInfo>();

  const resolve = (matId: string, stack: Set<string>): MaterialCostInfo => {
    const cached = memo.get(matId);
    if (cached) return cached;

    const mat = matById.get(matId);
    if (!mat) return { craftCost: 0, incomplete: true };

    const rows = mat.recipe ?? [];
    if (rows.length === 0) {
      const info: MaterialCostInfo = { craftCost: 0, incomplete: false };
      memo.set(matId, info);
      return info;
    }

    if (stack.has(matId)) return { craftCost: 0, incomplete: true };
    stack.add(matId);

    let craftCost = 0;
    let incomplete = false;

    for (const row of rows) {
      const ing = matById.get(row.ingredientMaterialId);
      if (!ing) {
        incomplete = true;
        continue;
      }

      let unitCost: number;
      if ((ing.recipe?.length ?? 0) > 0) {
        const sub = resolve(row.ingredientMaterialId, stack);
        incomplete = incomplete || sub.incomplete;
        const buy = effectivePriceOf(ing);
        unitCost = buy > 0 ? Math.min(buy, sub.craftCost) : sub.craftCost;
      } else {
        unitCost = effectivePriceOf(ing);
      }

      if (unitCost <= 0) incomplete = true;
      craftCost += unitCost * row.quantity;
    }

    stack.delete(matId);

    const info: MaterialCostInfo = { craftCost, incomplete };
    memo.set(matId, info);
    return info;
  };

  for (const id of matById.keys()) resolve(id, new Set());
  return memo;
}

/**
 * Total number of craft operations needed to produce one unit from scratch:
 * 1 for the material's own craft plus, recursively, one for every craftable
 * ingredient in its recipe tree (raw, non-craftable materials count as 0).
 * Cycle-safe and memoized.
 */
export function computeCraftCounts(
  matById: Map<string, BaseMaterial>,
): Map<string, number> {
  const memo = new Map<string, number>();

  const resolve = (matId: string, stack: Set<string>): number => {
    const cached = memo.get(matId);
    if (cached !== undefined) return cached;

    const mat = matById.get(matId);
    const rows = mat?.recipe ?? [];
    if (!mat || rows.length === 0) {
      memo.set(matId, 0);
      return 0;
    }

    if (stack.has(matId)) return 0;
    stack.add(matId);

    let count = 1;
    for (const row of rows) {
      const ing = matById.get(row.ingredientMaterialId);
      if (ing && (ing.recipe?.length ?? 0) > 0) {
        count += resolve(row.ingredientMaterialId, stack);
      }
    }

    stack.delete(matId);

    memo.set(matId, count);
    return count;
  };

  for (const id of matById.keys()) resolve(id, new Set());
  return memo;
}
