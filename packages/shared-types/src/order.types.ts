import { SubmarinePart } from './submarine.types';

export type OrderStatus = 'pending' | 'confirmed' | 'in_progress' | 'finished' | 'fulfilled' | 'cancelled';

export interface OrderItem {
  id?: number;
  orderId?: string;
  part?: SubmarinePart | null;
  partName: string;
  partType: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  buildName: string | null;
}

export interface Order {
  id: string;
  orderCode: string;
  clientName: string;
  isAnonymous?: boolean;
  contactInfo?: string | null;
  rawText?: string | null;
  subtotal: number;
  discountPct: number;
  discountAmt: number;
  total: number;
  status: OrderStatus;
  notes?: string | null;
  fulfillmentDt?: string | null;
  confirmedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
}

export interface BulkDiscount {
  id: string;
  threshold: number;
  discountPercent: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateOrderDto {
  clientName: string;
  isAnonymous?: boolean;
  contactInfo?: string;
  rawText?: string;
  items: Array<{
    partId: string;
    quantity: number;
    buildName?: string;
  }>;
  notes?: string;
  fulfillmentDt?: string;
}

export interface InProgressOrderFeedItem {
  id: string;
  orderCode: string;
  clientName: string;
  isAnonymous: boolean;
  contactInfo: string | null;
  notes: string | null;
  confirmedAt: string | null;
  createdAt: string;
  items: Array<{
    partId: string;
    partName: string;
    partType: string | null;
    buildName: string | null;
    quantity: number;
    stock: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  missingMaterials: MissingMaterial[];
  /** Live profitability of the whole order: revenue (after discount) vs current material prices */
  financials: OrderFinancials;
}

/** Revenue vs material cost for an order (materials valued at effective prices).
 * Repair kits and other product rows are excluded entirely from both sides. */
export interface OrderFinancials {
  /** Revenue of the craftable parts in the order, after the order discount */
  revenue: number;
  /** Cost of raw materials to craft the craftable parts in the order */
  materialCost: number;
  /** revenue - materialCost */
  profit: number;
}

/** Requirements aggregated across ALL in-progress orders */
export interface InProgressAggregate {
  revenue: number;
  materialCost: number;
  profit: number;
  /** Every material required by any in-progress order, with the shortfall vs current stock */
  materials: InProgressMaterialRequirement[];
}

export interface InProgressMaterialRequirement {
  materialId: string;
  name: string;
  itemId: number | null;
  /** Total units required across all in-progress orders */
  needed: number;
  /** Current stock covering the requirement */
  available: number;
  /** needed - available (never below 0) */
  missing: number;
}

export interface MissingMaterial {
  materialId: string;
  name: string;
  itemId: number | null;
  /** Total units required to craft the parts still missing for this order */
  needed: number;
  /** Units still unclaimed by earlier in-progress orders */
  available: number;
  /** needed - available (never below 0) */
  missing: number;
}
