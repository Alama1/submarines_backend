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
  /** craftCost - myPrice (null when no custom price is set) */
  diff: number | null;
  /** diff as percentage of myPrice (null when no custom price is set) */
  diffPct: number | null;
  /** true when some ingredient has no price source, i.e. craft cost may be understated */
  incomplete: boolean;
  /** true when the row deviates beyond the currently configured thresholds */
  isAnomaly: boolean;
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
 * Anomaly detector thresholds. A row is flagged when EITHER check fires:
 *   |diffPct| > thresholdPct  (when thresholdPct is not null)
 *   |diff|   > thresholdGil   (when thresholdGil is not null)
 * A null threshold disables that check.
 */
export interface AnomalyThresholds {
  thresholdPct: number | null;
  thresholdGil: number | null;
}

export const ANOMALY_THRESHOLD_PCT_KEY = 'anomalies.thresholdPct';
export const ANOMALY_THRESHOLD_GIL_KEY = 'anomalies.thresholdGil';

/** Default % deviation flag when nothing is configured */
export const PRICE_ANOMALY_THRESHOLD_PCT = 10;

export interface StockStatusResponse {
  materials: BaseMaterial[];
  total: number;
  missingCount: number;
}

export interface MaterialClaim {
  id: string;
  materialId: string;
  claimedFor: string;
  quantity: number;
  createdAt: string;
}

export interface MaterialClaimOverview extends MaterialClaim {
  materialName: string;
  currentStock: number;
  desiredQuantity: number;
  deficit: number;
}

export interface AllClaimsResponse {
  items: MaterialClaimOverview[];
  total: number;
}

export interface CreateMaterialClaimDto {
  claimedFor: string;
  quantity: number;
}

export interface MaterialClaimsResponse {
  material: Pick<BaseMaterial, 'id' | 'name' | 'currentStock' | 'desiredQuantity'>;
  deficit: number;
  totalClaimed: number;
  remaining: number;
  claims: MaterialClaim[];
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

