import { SubmarinePart } from './submarine-part.entity';
import { BaseMaterial } from './base-material.entity';

export interface ExpandedMaterialRequirement {
  materialId: string;
  name: string;
  quantity: number;
}

export function expandAllPartMaterials(
  parts: SubmarinePart[],
): Map<string, ExpandedMaterialRequirement[]> {
  const partByName = new Map<string, SubmarinePart>();
  for (const p of parts) partByName.set(p.name.toLowerCase(), p);

  const materialNames = new Map<string, string>();
  for (const p of parts) {
    for (const pm of p.materials ?? []) {
      if (pm.material) materialNames.set(pm.material.id, pm.material.name);
    }
  }

  const cache = new Map<string, Map<string, number>>();

  const expand = (part: SubmarinePart, stack: Set<string>): Map<string, number> => {
    const cached = cache.get(part.id);
    if (cached) return cached;

    const result = new Map<string, number>();
    if (stack.has(part.id)) return result;
    stack.add(part.id);

    for (const pm of part.materials ?? []) {
      if (!pm.material) continue;
      const nested = partByName.get(pm.material.name.toLowerCase());
      if (nested && nested.id !== part.id) {
        for (const [matId, qty] of expand(nested, stack)) {
          result.set(matId, (result.get(matId) ?? 0) + qty * pm.quantity);
        }
      } else {
        result.set(pm.material.id, (result.get(pm.material.id) ?? 0) + pm.quantity);
      }
    }

    stack.delete(part.id);
    cache.set(part.id, result);
    return result;
  };

  const out = new Map<string, ExpandedMaterialRequirement[]>();
  for (const part of parts) {
    const raw = expand(part, new Set());
    const list: ExpandedMaterialRequirement[] = [...raw.entries()].map(
      ([materialId, quantity]) => ({
        materialId,
        name: materialNames.get(materialId) ?? materialId,
        quantity,
      }),
    );
    list.sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
    out.set(part.id, list);
  }
  return out;
}

/**
 * Collects the IDs of every material involved in submarine part crafting:
 * all materials referenced directly by any part, plus everything reachable
 * through their craft recipes (recursively).
 */
export function collectPartMaterialIds(
  parts: SubmarinePart[],
  matById: Map<string, BaseMaterial>,
): Set<string> {
  const result = new Set<string>();
  const stack: string[] = [];

  for (const p of parts) {
    for (const pm of p.materials ?? []) {
      if (pm.material) stack.push(pm.material.id);
    }
  }

  while (stack.length) {
    const id = stack.pop()!;
    if (result.has(id)) continue;
    result.add(id);
    const mat = matById.get(id);
    for (const row of mat?.recipe ?? []) {
      stack.push(row.ingredientMaterialId);
    }
  }

  return result;
}
