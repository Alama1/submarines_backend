export interface PartSetProfitItem {
  partId: string | null;
  partName: string;
  quantity: number;
  unitSalePrice: number;
  saleTotal: number;
  materialCostPerUnit: number;
  materialCostTotal: number;
  profit: number;
}

export interface PartSetProfit {
  id: string;
  name: string;
  description: string | null;
  items: PartSetProfitItem[];
  totalSale: number;
  totalMaterialCost: number;
  totalProfit: number;
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
