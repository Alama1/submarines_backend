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
}
