// backend/src/modules/marketplace/stock-transfer-receipt.types.ts
// receipt_status: in_progress | completed | cancelled (criado em 0130; case convergido para
// 07_NOMENCLATURA §4.11 em 20260801120000). Não renomear de um lado só.

export type StockTransferReceiptStatus = 'in_progress' | 'completed' | 'cancelled';

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
