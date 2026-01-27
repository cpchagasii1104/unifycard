// backend/src/modules/marketplace/stock-transfer-receipt.types.ts
// SPRINT 56: Tipos para conferência de recebimento de transferências

export type StockTransferReceiptStatus = 'IN_PROGRESS' | 'PARTIAL' | 'COMPLETE' | 'REJECTED';

export interface StockTransferReceipt {
  id: string;
  tenantId: string;
  stockTransferId: string;
  receivedByUserId: string;
  receivedAt: Date;
  status: StockTransferReceiptStatus;
  notes?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: Date;
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
  createdAt: Date;
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







