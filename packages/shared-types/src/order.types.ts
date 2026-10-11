import { SubmarinePart } from './submarine.types';
import { MaterialSource } from './material.types';

export type OrderStatus = 'pending' | 'confirmed' | 'in_progress' | 'finished' | 'fulfilled' | 'cancelled';

export type OrderDiscountSource = 'bulk' | 'promo';

export type DiscountCodeType = 'flat' | 'percent';

export type DiscountCodeStatus = 'active' | 'scheduled' | 'expired' | 'exhausted';

export interface OrderItem {
  id?: number;
  orderId?: string;
  part?: SubmarinePart | null;
  partName: string;
  partType: string | null;
  quantity: number;
  /** Handed over so far (partial deliveries); undefined on legacy payloads. */
  deliveredQuantity?: number;
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
  discountSource?: OrderDiscountSource;
  promoCodeId?: string | null;
  promoCode?: string | null;
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

export interface CrafterBulkDiscount {
  id: string;
  threshold: number;
  discountPercent: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DiscountCode {
  id: string;
  code: string;
  discountType: DiscountCodeType;
  discountValue: number;
  maxUses: number;
  usedCount: number;
  activeFrom: string | null;
  activeUntil: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDiscountCodeDto {
  code?: string;
  discountType: DiscountCodeType;
  discountValue: number;
  maxUses: number;
  activeFrom?: string | null;
  activeUntil?: string | null;
}

export interface UpdateDiscountCodeDto extends Partial<CreateDiscountCodeDto> {}

export type PromoCodeRejectionReason = 'not_found' | 'not_started' | 'expired' | 'exhausted';

export interface PromoCodeValidationResponse {
  valid: boolean;
  reason?: PromoCodeRejectionReason;
  message?: string;
  code?: Omit<DiscountCode, 'id' | 'createdAt' | 'updatedAt'> & { remainingUses: number };
  discountAmt?: number;
}

export interface CreateOrderDto {
  clientName: string;
  isAnonymous?: boolean;
  contactInfo?: string;
  rawText?: string;
  promoCode?: string;
  items: Array<{
    partId: string;
    quantity: number;
    buildName?: string;
  }>;
  notes?: string;
  fulfillmentDt?: string;
}

/** Records / corrects how many units of each order item were handed over. */
export interface RecordDeliveryDto {
  items: Array<{
    itemId: number;
    /** Absolute delivered count (0..quantity) — setting it corrects previous values. */
    deliveredQuantity: number;
  }>;
}

export interface InProgressOrderFeedItem {
  id: string;
  orderCode: string;
  clientName: string;
  isAnonymous: boolean;
  contactInfo: string | null;
  notes: string | null;
  fulfillmentDt: string | null;
  confirmedAt: string | null;
  createdAt: string;
  items: Array<{
    partId: string;
    partName: string;
    partType: string | null;
    buildName: string | null;
    quantity: number;
    deliveredQuantity: number;
    remaining: number;
    stock: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  missingMaterials: MissingMaterial[];
  financials: OrderFinancials;
}

export interface OrderFinancials {
  revenue: number;
  materialCost: number;
  profit: number;
}

export interface InProgressAggregate {
  revenue: number;
  materialCost: number;
  profit: number;
  materials: InProgressMaterialRequirement[];
}

export interface InProgressMaterialRequirement {
  materialId: string;
  name: string;
  itemId: number | null;
  needed: number;
  available: number;
  missing: number;
  whereToBuy: MaterialSource;
}

export interface MissingMaterial {
  materialId: string;
  name: string;
  itemId: number | null;
  needed: number;
  available: number;
  missing: number;
}
