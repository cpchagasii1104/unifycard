// backend/src/modules/marketplace/stock-transfer-receipt.types.ts
// receipt_status: IN_PROGRESS | COMPLETED | CANCELLED (migration 0130)

export type StockTransferReceiptStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface StockTransferReceipt {
  id: string;
  tenantId: string;
  stockTransferId: string;
  receivedByUserId: string;
  receivedAt: Date;
  status: StockTransferReceiptStatus;
  notes?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export interface StockTransferReceiptItem {
  id: string;
  tenantId: string;
  receiptId: string;
  stockTransferItemId: string;
  expectedQuantity: number;
  receivedQuantity: number;
  inventoryLotId?: string | null;
  discrepancyReason?: string | null;
  createdAt: string;
}

export interface StartReceiptInput {
  receivedByUserId: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface ReceiveItemInput {
  stockTransferItemId: string;
  receivedQuantity: number;
  inventoryLotId?: string;
  discrepancyReason?: string;
  metadata?: Record<string, any>;
}

export interface FinalizeReceiptInput {
  notes?: string;
  metadata?: Record<string, any>;
}
