export type MaterialSource = 'Market' | 'Craft' | 'NPC';

export const MATERIAL_SOURCES: MaterialSource[] = ['Market', 'Craft', 'NPC'];

export type MaterialCategory = 'crafting' | 'repair';

export const MATERIAL_CATEGORIES: MaterialCategory[] = ['crafting', 'repair'];

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
}

export interface StockStatusResponse {
  materials: BaseMaterial[];
  total: number;
  missingCount: number;
}

/** A person's pledge to deliver a quantity of a missing material */
export interface MaterialClaim {
  id: string;
  materialId: string;
  claimedFor: string;
  quantity: number;
  createdAt: string;
}

/** Claim with material context, returned by GET /inventory/claims */
export interface MaterialClaimOverview extends MaterialClaim {
  materialName: string;
  currentStock: number;
  desiredQuantity: number;
  deficit: number;
}

/** Response of GET /inventory/claims — every claim across all materials */
export interface AllClaimsResponse {
  items: MaterialClaimOverview[];
  total: number;
}

export interface CreateMaterialClaimDto {
  claimedFor: string;
  quantity: number;
}

/** Claims response for a single material */
export interface MaterialClaimsResponse {
  material: Pick<BaseMaterial, 'id' | 'name' | 'currentStock' | 'desiredQuantity'>;
  deficit: number;
  totalClaimed: number;
  remaining: number;
  claims: MaterialClaim[];
}

/** Item shape returned by GET /inventory/missing (includes claim info) */
export interface MissingMaterialItem {
  id: string;
  name: string;
  itemId: number | null;
  currentStock: number;
  desiredQuantity: number;
  deficit: number;
  /** Sum of all claim quantities against this material */
  claimed: number;
  /** deficit - claimed (never below 0) */
  remaining: number;
  claims: MaterialClaim[];
  whereToBuy: MaterialSource;
  category: MaterialCategory;
  updatedAt: string;
}

