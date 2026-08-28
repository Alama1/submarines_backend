import { SubmarinePart } from './submarine.types';

export type OrderStatus = 'pending' | 'processing' | 'fulfilled' | 'cancelled';

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
  id?: string;
  clientName: string;
  rawText: string | null;
  subtotal: number;
  discountPct: number;
  discountAmt: number;
  total: number;
  status: OrderStatus;
  notes: string | null;
  fulfillmentDt: string | null;
  createdAt?: string;
  updatedAt?: string;
  items?: OrderItem[];
}

export interface CreateOrderDto {
  clientName: string;
  rawText?: string;
  items: Array<{
    partId?: string;
    partName: string;
    partType?: string;
    quantity: number;
    unitPrice: number;
    buildName?: string;
  }>;
  notes?: string;
  fulfillmentDt?: string;
}

