// backend/src/modules/marketplace/stock-transfer-receipt.repository.ts
// SPRINT 56: Repository para conferência de recebimento

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  StockTransferReceipt,
  StockTransferReceiptItem,
  StartReceiptInput,
  ReceiveItemInput,
} from './stock-transfer-receipt.types';

interface StockTransferReceiptRow {
  id: string;
  tenant_id: string;
  stock_transfer_id: string;
  received_by_user_id: string;
  received_at: Date;
  status: string;
  notes: string | null;
  metadata: any;
  created_at: Date;
}

interface StockTransferReceiptItemRow {
  id: string;
  tenant_id: string;
  receipt_id: string;
  stock_transfer_item_id: string;
  expected_quantity: string;
  received_quantity: string;
  inventory_lot_id: string | null;
  discrepancy_reason: string | null;
  created_at: Date;
}

class StockTransferReceiptRepository {
  /**
   * Converte row para StockTransferReceipt
   */
  private toReceipt(row: StockTransferReceiptRow): StockTransferReceipt {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      stockTransferId: row.stock_transfer_id,
      receivedByUserId: row.received_by_user_id,
      receivedAt: row.received_at,
      status: row.status as any,
      notes: row.notes,
      metadata: row.metadata || null,
      createdAt: row.created_at,
    };
  }

  /**
   * Converte row para StockTransferReceiptItem
   */
  private toReceiptItem(row: StockTransferReceiptItemRow): StockTransferReceiptItem {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      receiptId: row.receipt_id,
      stockTransferItemId: row.stock_transfer_item_id,
      expectedQuantity: parseFloat(row.expected_quantity),
      receivedQuantity: parseFloat(row.received_quantity),
      inventoryLotId: row.inventory_lot_id,
      discrepancyReason: row.discrepancy_reason,
      createdAt: row.created_at,
    };
  }

  /**
   * Cria receipt (inicia conferência)
   */
  async createReceipt(
    tenantId: string,
    stockTransferId: string,
    input: StartReceiptInput
  ): Promise<StockTransferReceipt> {
    const row = await runQueryWithTenant<StockTransferReceiptRow>(
      tenantId,
      `
      INSERT INTO stock_transfer_receipts (
        tenant_id, stock_transfer_id, received_by_user_id, received_at, status, notes, metadata
      )
      VALUES ($1, $2, $3, NOW(), 'IN_PROGRESS', $4, $5)
      RETURNING id, tenant_id, stock_transfer_id, received_by_user_id, received_at,
                status, notes, metadata, created_at
      `,
      [
        tenantId,
        stockTransferId,
        input.receivedByUserId,
        input.notes || null,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar receipt');
    }

    return this.toReceipt(row);
  }

  /**
   * Busca receipt por ID
   */
  async getReceiptById(
    tenantId: string,
    receiptId: string
  ): Promise<StockTransferReceipt | null> {
    const row = await runQueryWithTenant<StockTransferReceiptRow>(
      tenantId,
      `
      SELECT id, tenant_id, stock_transfer_id, received_by_user_id, received_at,
             status, notes, metadata, created_at
      FROM stock_transfer_receipts
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, receiptId]
    );

    return row ? this.toReceipt(row) : null;
  }

  /**
   * Busca receipt por transferência
   */
  async getReceiptByTransferId(
    tenantId: string,
    stockTransferId: string
  ): Promise<StockTransferReceipt | null> {
    const row = await runQueryWithTenant<StockTransferReceiptRow>(
      tenantId,
      `
      SELECT id, tenant_id, stock_transfer_id, received_by_user_id, received_at,
             status, notes, metadata, created_at
      FROM stock_transfer_receipts
      WHERE tenant_id = $1 AND stock_transfer_id = $2
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [tenantId, stockTransferId]
    );

    return row ? this.toReceipt(row) : null;
  }

  /**
   * Atualiza status do receipt
   */
  async updateReceiptStatus(
    tenantId: string,
    receiptId: string,
    status: StockTransferReceipt['status'],
    notes?: string
  ): Promise<StockTransferReceipt> {
    const updates: string[] = [`status = $1`];
    const params: any[] = [status];
    let paramIndex = 2;

    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex}`);
      params.push(notes);
      paramIndex++;
    }

    params.push(tenantId, receiptId);

    const row = await runQueryWithTenant<StockTransferReceiptRow>(
      tenantId,
      `
      UPDATE stock_transfer_receipts
      SET ${updates.join(', ')}
      WHERE tenant_id = $${paramIndex} AND id = $${paramIndex + 1}
      RETURNING id, tenant_id, stock_transfer_id, received_by_user_id, received_at,
                status, notes, metadata, created_at
      `,
      params
    );

    if (!row) {
      throw new Error(`Receipt não encontrado: ${receiptId}`);
    }

    return this.toReceipt(row);
  }

  /**
   * Cria item de receipt (conferência de item)
   */
  async createReceiptItem(
    tenantId: string,
    receiptId: string,
    stockTransferItemId: string,
    expectedQuantity: number,
    input: ReceiveItemInput
  ): Promise<StockTransferReceiptItem> {
    const row = await runQueryWithTenant<StockTransferReceiptItemRow>(
      tenantId,
      `
      INSERT INTO stock_transfer_receipt_items (
        tenant_id, receipt_id, stock_transfer_item_id, expected_quantity,
        received_quantity, inventory_lot_id, discrepancy_reason
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, tenant_id, receipt_id, stock_transfer_item_id, expected_quantity,
                received_quantity, inventory_lot_id, discrepancy_reason, created_at
      `,
      [
        tenantId,
        receiptId,
        stockTransferItemId,
        expectedQuantity,
        input.receivedQuantity,
        input.inventoryLotId || null,
        input.discrepancyReason || null,
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar item de receipt');
    }

    return this.toReceiptItem(row);
  }

  /**
   * Lista itens de receipt
   */
  async listReceiptItems(
    tenantId: string,
    receiptId: string
  ): Promise<StockTransferReceiptItem[]> {
    const rows = await runQueriesWithTenant<StockTransferReceiptItemRow>(
      tenantId,
      `
      SELECT id, tenant_id, receipt_id, stock_transfer_item_id, expected_quantity,
             received_quantity, inventory_lot_id, discrepancy_reason, created_at
      FROM stock_transfer_receipt_items
      WHERE tenant_id = $1 AND receipt_id = $2
      ORDER BY created_at ASC
      `,
      [tenantId, receiptId]
    );

    return rows.map((row) => this.toReceiptItem(row));
  }

  /**
   * Busca item de receipt por transfer item
   */
  async getReceiptItemByTransferItemId(
    tenantId: string,
    receiptId: string,
    stockTransferItemId: string
  ): Promise<StockTransferReceiptItem | null> {
    const row = await runQueryWithTenant<StockTransferReceiptItemRow>(
      tenantId,
      `
      SELECT id, tenant_id, receipt_id, stock_transfer_item_id, expected_quantity,
             received_quantity, inventory_lot_id, discrepancy_reason, created_at
      FROM stock_transfer_receipt_items
      WHERE tenant_id = $1 AND receipt_id = $2 AND stock_transfer_item_id = $3
      LIMIT 1
      `,
      [tenantId, receiptId, stockTransferItemId]
    );

    return row ? this.toReceiptItem(row) : null;
  }
}

export const stockTransferReceiptRepository = new StockTransferReceiptRepository();







