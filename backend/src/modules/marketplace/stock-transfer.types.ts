// backend/src/modules/marketplace/stock-transfer.types.ts
// Alinhado a stock_transfer_status (migration 0129).

export type StockTransferStatus = 'DRAFT' | 'PENDING' | 'SHIPPED' | 'RECEIVED' | 'CANCELLED';

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
  createdAt: string;
  updatedAt: string;
}

/** Linha em stock_transfer_items — sem coluna status no BD. */
export interface StockTransferItem {
  id: string;
  tenantId: string;
  stockTransferId: string;
  productVariantId: string;
  quantity: number;
  inventoryLotId?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
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

/** @deprecated Preferir stockTransferReceiptService.startReceipt — exige receivedByUserId para criar receipt. */
export interface ReceiveStockTransferInput {
  /** Obrigatório para delegar a startReceipt (conferência). Pode vir em metadata.receivedByUserId. */
  receivedByUserId?: string;
  notes?: string;
  metadata?: Record<string, any>;
}
