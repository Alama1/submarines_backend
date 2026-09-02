/** A set's part line with computed sale/cost/profit at current prices */
export interface PartSetProfitItem {
  /** null when the part was deleted after the set was created */
  partId: string | null;
  partName: string;
  quantity: number;
  /** Current sale price of one part (submarine_parts.price) */
  unitSalePrice: number;
  /** unitSalePrice * quantity */
  saleTotal: number;
  /** Raw-material cost to craft one part (fully expanded recipe, effective prices) */
  materialCostPerUnit: number;
  /** materialCostPerUnit * quantity */
  materialCostTotal: number;
  /** saleTotal - materialCostTotal */
  profit: number;
}

/** A persisted part set with live profitability */
export interface PartSetProfit {
  id: string;
  name: string;
  description: string | null;
  items: PartSetProfitItem[];
  totalSale: number;
  totalMaterialCost: number;
  totalProfit: number;
  /** totalProfit / totalSale * 100 (0 when totalSale is 0) */
  profitMarginPct: number;
}

export interface CreatePartSetDto {
  name: string;
  description?: string;
  items: Array<{
    partId: string;
    quantity: number;
  }>;
}

export interface UpdatePartSetDto extends Partial<CreatePartSetDto> {}
