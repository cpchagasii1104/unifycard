// backend/src/modules/marketplace/fulfillment.types.ts
// SPRINT 54: Tipos para fulfillment

// Case canônico: status/lifecycle em snake_case minúsculo (07_NOMENCLATURA §4.11); source em
// lowercase com o vocabulário da própria norma (§4.40 lista 'pdv' e 'marketplace').
// Espelha os enums físicos fulfillment_source/fulfillment_status/fulfillment_item_status
// (migration 20260801120000). Não renomear de um lado só.
export type FulfillmentSource = 'pdv' | 'marketplace';
export type FulfillmentStatus = 'pending' | 'picked' | 'shipped' | 'cancelled';
export type FulfillmentItemStatus = 'pending' | 'picked';

export interface FulfillmentOrder {
  id: string;
  tenantId: string;
  orderId: string;
  source: FulfillmentSource;
  status: FulfillmentStatus;
  pickedByUserId?: string | null;
  shippedAt?: Date | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
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








