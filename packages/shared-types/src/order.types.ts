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
}

export interface MissingMaterial {
  materialId: string;
  name: string;
  itemId: number | null;
  /** Total units required to craft the parts still missing for this order */
  needed: number;
  /** Units still unclaimed by earlier in-progress orders (or covered by part stock) */
  available: number;
  /** needed - available (never below 0) */
  missing: number;
  /** True for part-as-material requirements (e.g. modified parts needing their base part) */
  isPart: boolean;
}
