import { SubmarinePart } from './submarine-part.entity';

export interface ExpandedMaterialRequirement {
  materialId: string;
  name: string;
  quantity: number;
}

/**
 * Resolves "part-as-material" references (a modified part requiring 1x its
 * non-modified counterpart) recursively into aggregated raw base-material
 * requirements.
 *
 * Returns a map: partId -> list of raw material requirements for crafting
 * one unit of that part, including every nested part's recipe. Direct
 * base-material rows are counted as-is; rows whose material matches another
 * SubmarinePart by name are expanded and multiplied by their quantity.
 */
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
