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

