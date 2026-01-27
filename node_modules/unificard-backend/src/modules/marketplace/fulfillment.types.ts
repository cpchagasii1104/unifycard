// backend/src/modules/marketplace/fulfillment.types.ts
// SPRINT 54: Tipos para fulfillment

export type FulfillmentSource = 'PDV' | 'MARKETPLACE';
export type FulfillmentStatus = 'PENDING' | 'PICKED' | 'SHIPPED' | 'CANCELLED';
export type FulfillmentItemStatus = 'PENDING' | 'PICKED';

export interface FulfillmentOrder {
  id: string;
  tenantId: string;
  orderId: string;
  source: FulfillmentSource;
  status: FulfillmentStatus;
  pickedByUserId?: string | null;
  shippedAt?: Date | null;
  metadata?: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FulfillmentItem {
  id: string;
  tenantId: string;
  fulfillmentOrderId: string;
  productVariantId: string;
  quantity: number;
  inventoryLotId?: string | null;
  status: FulfillmentItemStatus;
  metadata?: Record<string, any> | null;
  createdAt: Date;
}

export interface CreateFulfillmentOrderInput {
  orderId: string;
  source: FulfillmentSource;
  metadata?: Record<string, any>;
}

export interface PickFulfillmentItemInput {
  fulfillmentItemId: string;
  pickedByUserId: string;
  inventoryLotId?: string; // Opcional: especificar lote ao fazer picking
  metadata?: Record<string, any>;
}

export interface ShipFulfillmentOrderInput {
  fulfillmentOrderId: string;
  metadata?: Record<string, any>;
}







