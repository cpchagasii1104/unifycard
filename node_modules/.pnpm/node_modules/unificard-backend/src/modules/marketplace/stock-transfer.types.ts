// backend/src/modules/marketplace/stock-transfer.types.ts
// SPRINT 55: Tipos para transferência de estoque entre filiais

export type StockTransferStatus = 'DRAFT' | 'SHIPPED' | 'RECEIVING' | 'RECEIVED' | 'CANCELLED'; // SPRINT 56: Adicionado RECEIVING
export type StockTransferItemStatus = 'PENDING' | 'SHIPPED' | 'RECEIVED';

export interface StockTransfer {
  id: string;
  tenantId: string;
  fromActorId: string;
  toActorId: string;
  status: StockTransferStatus;
  requestedByUserId?: string | null;
  shippedAt?: Date | null;
  receivedAt?: Date | null;
  metadata?: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockTransferItem {
  id: string;
  tenantId: string;
  stockTransferId: string;
  productVariantId: string;
  quantity: number;
  inventoryLotId?: string | null;
  status: StockTransferItemStatus;
  metadata?: Record<string, any> | null;
  createdAt: Date;
}

export interface CreateStockTransferInput {
  fromActorId: string;
  toActorId: string;
  requestedByUserId?: string;
  metadata?: Record<string, any>;
}

export interface AddStockTransferItemInput {
  productVariantId: string;
  quantity: number;
  inventoryLotId?: string;
  metadata?: Record<string, any>;
}

export interface ShipStockTransferInput {
  metadata?: Record<string, any>;
}

export interface ReceiveStockTransferInput {
  metadata?: Record<string, any>;
}

