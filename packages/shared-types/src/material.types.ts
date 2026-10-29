export type MaterialSource = 'Market' | 'Craft' | 'NPC';

export const MATERIAL_SOURCES: MaterialSource[] = ['Market', 'Craft', 'NPC'];

export type MaterialCategory = 'crafting' | 'repair';

export const MATERIAL_CATEGORIES: MaterialCategory[] = ['crafting', 'repair'];

export interface MaterialIngredient {
  id: string;
  materialId: string;
  ingredientMaterialId: string;
  ingredientName?: string | null;
  quantity: number;
}

export interface MaterialIngredientInput {
  ingredientMaterialId: string;
  quantity: number;
}

export interface BaseMaterial {
  id: string;
  name: string;
  itemId?: number | null;
  desiredQuantity: number;
  currentStock: number;
  marketPrice?: number | null;
  myPrice?: number | null;
  npcPrice?: number | null;
  whereToBuy: MaterialSource;
  category: MaterialCategory;
  recipe?: MaterialIngredient[];
  updatedAt: string;
}

export interface CreateMaterialDto {
  name: string;
  itemId?: number;
  desiredQuantity?: number;
  currentStock?: number;
  marketPrice?: number;
  myPrice?: number;
  npcPrice?: number;
  whereToBuy?: MaterialSource;
  category?: MaterialCategory;
  ingredients?: MaterialIngredientInput[];
}

export interface UpdateMaterialDto {
  name?: string;
  itemId?: number;
  desiredQuantity?: number;
  currentStock?: number;
  marketPrice?: number;
  myPrice?: number;
  npcPrice?: number;
  whereToBuy?: MaterialSource;
  category?: MaterialCategory;
  ingredients?: MaterialIngredientInput[];
}

export interface MaterialIngredientCost {
  ingredientMaterialId: string;
  name: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  crafted: boolean;
}

export interface PriceAnomalyItem {
  id: string;
  name: string;
  itemId: number | null;
  myPrice: number | null;
  marketPrice: number | null;
  whereToBuy: string;
  craftCost: number;
  /**
   * Total number of craft operations needed to produce one unit:
   * 1 for the item's own craft plus one per craftable ingredient,
   * recursively through the recipe tree (raw materials count as 0).
   */
  craftCount: number;
  /** craftCost - myPrice (null when no custom price is set) */
  diff: number | null;
  /** diff as percentage of myPrice (null when no custom price is set) */
  diffPct: number | null;
  /** true when some ingredient has no price source, i.e. craft cost may be understated */
  incomplete: boolean;
  /** true when the row deviates beyond the currently configured thresholds */
  isAnomaly: boolean;
  /** true when the material is on the anomaly ignore list (hidden by default) */
  anomalyIgnore: boolean;
  ingredients: MaterialIngredientCost[];
}

export interface PriceAnomaliesResponse {
  items: PriceAnomalyItem[];
  total: number;
  /** rows flagged by the currently configured thresholds */
  anomalyCount: number;
  thresholds: AnomalyThresholds;
}

/**
 * Anomaly detector settings (flat gil only).
 *
 * The custom price ("my price") is expected to sit at least `desiredDiff`
 * above the craft cost. `desiredDiffOffset` is the tolerated shortfall:
 * a row is flagged when
 *   myPrice - craftCost < desiredDiff - desiredDiffOffset
 * A null desiredDiff disables flagging entirely; a null offset is treated as 0.
 */
export interface AnomalyThresholds {
  desiredDiff: number | null;
  desiredDiffOffset: number | null;
}

export const ANOMALY_DESIRED_DIFF_KEY = 'anomalies.desiredDiff';
export const ANOMALY_DESIRED_DIFF_OFFSET_KEY = 'anomalies.desiredDiffOffset';

/** Default desired diff (custom price must exceed craft cost) */
export const PRICE_ANOMALY_DESIRED_DIFF = 0;

export interface StockStatusResponse {
  materials: BaseMaterial[];
  total: number;
  missingCount: number;
}

/**
 * Net worth of the current stock, valued two ways:
 *  - market: Σ currentStock × universalis market price (unpriced → 0)
 *  - my:     Σ currentStock × (myPrice ?? marketPrice ?? npcPrice)
 */
export interface NetWorthResponse {
  marketNetWorth: number;
  myNetWorth: number;
  /** materials included in the totals */
  materialCount: number;
  /** materials with no usable price source (they contribute 0) */
  unpricedCount: number;
}

export type CraftClaimStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export const CRAFT_CLAIM_STATUSES: CraftClaimStatus[] = [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
];

export interface CraftClaimItem {
  id: number;
  materialId: string | null;
  materialName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface CraftClaim {
  id: string;
  claimCode: string;
  nickname: string;
  status: CraftClaimStatus;
  subtotal: number;
  bonusPct: number;
  bonusAmount: number;
  total: number;
  confirmedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: CraftClaimItem[];
}

export interface CreateCraftClaimItemDto {
  materialId: string;
  quantity: number;
}

export interface CreateCraftClaimDto {
  nickname: string;
  items: CreateCraftClaimItemDto[];
}

/** A single material entry in the public missing-materials feed (from active claims). */
export interface MaterialClaim {
  id: number;
  claimedFor: string;
  quantity: number;
  createdAt: string;
}

export interface MissingMaterialItem {
  id: string;
  name: string;
  itemId: number | null;
  currentStock: number;
  desiredQuantity: number;
  deficit: number;
  claimed: number;
  remaining: number;
  claims: MaterialClaim[];
  whereToBuy: MaterialSource;
  category: MaterialCategory;
  updatedAt: string;
}

