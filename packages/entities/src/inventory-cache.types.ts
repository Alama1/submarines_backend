/**
 * Shape of a single scanned inventory slot as reported by the FFXIV plugin.
 */
export interface StoredItem {
  itemId: number;
  itemName?: string | null;
  quantity: number;
  isHQ?: boolean;
  condition?: number;
}

/**
 * Shape of a single bag/container as reported by the FFXIV plugin.
 * Used for the jsonb columns of the server-side inventory cache.
 */
export interface StoredBag {
  bagName: string;
  items: StoredItem[];
}

/** Builds the stable key used to identify a character across devices. */
export function characterKeyOf(name: string, homeWorld?: string | null): string {
  return `${name.trim().toLowerCase()}@${(homeWorld ?? '').trim().toLowerCase()}`;
}
