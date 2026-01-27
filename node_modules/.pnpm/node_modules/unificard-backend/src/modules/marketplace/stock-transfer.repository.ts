// backend/src/modules/marketplace/stock-transfer.repository.ts
// SPRINT 55: Repository para transferências de estoque

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  StockTransfer,
  StockTransferItem,
  CreateStockTransferInput,
  AddStockTransferItemInput,
} from './stock-transfer.types';

interface StockTransferRow {
  id: string;
  tenant_id: string;
  from_actor_id: string;
  to_actor_id: string;
  status: string;
  requested_by_user_id: string | null;
  shipped_at: Date | null;
  received_at: Date | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

interface StockTransferItemRow {
  id: string;
  tenant_id: string;
  stock_transfer_id: string;
  product_variant_id: string;
  quantity: string;
  inventory_lot_id: string | null;
  status: string;
  metadata: any;
  created_at: Date;
}

class StockTransferRepository {
  /**
   * Converte row para StockTransfer
   */
  private toStockTransfer(row: StockTransferRow): StockTransfer {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      fromActorId: row.from_actor_id,
      toActorId: row.to_actor_id,
      status: row.status as any,
      requestedByUserId: row.requested_by_user_id,
      shippedAt: row.shipped_at,
      receivedAt: row.received_at,
      metadata: row.metadata || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Converte row para StockTransferItem
   */
  private toStockTransferItem(row: StockTransferItemRow): StockTransferItem {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      stockTransferId: row.stock_transfer_id,
      productVariantId: row.product_variant_id,
      quantity: parseFloat(row.quantity),
      inventoryLotId: row.inventory_lot_id,
      status: row.status as any,
      metadata: row.metadata || null,
      createdAt: row.created_at,
    };
  }

  /**
   * Cria transferência
   */
  async createTransfer(
    tenantId: string,
    input: CreateStockTransferInput
  ): Promise<StockTransfer> {
    // Validar que origem e destino são diferentes
    if (input.fromActorId === input.toActorId) {
      throw new Error('Origem e destino devem ser diferentes');
    }

    const row = await runQueryWithTenant<StockTransferRow>(
      tenantId,
      `
      INSERT INTO stock_transfers (
        tenant_id, from_actor_id, to_actor_id, status, requested_by_user_id, metadata
      )
      VALUES ($1, $2, $3, 'DRAFT', $4, $5)
      RETURNING id, tenant_id, from_actor_id, to_actor_id, status,
                requested_by_user_id, shipped_at, received_at, metadata, created_at, updated_at
      `,
      [
        tenantId,
        input.fromActorId,
        input.toActorId,
        input.requestedByUserId || null,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar transferência de estoque');
    }

    return this.toStockTransfer(row);
  }

  /**
   * Busca transferência por ID
   */
  async getTransferById(
    tenantId: string,
    transferId: string
  ): Promise<StockTransfer | null> {
    const row = await runQueryWithTenant<StockTransferRow>(
      tenantId,
      `
      SELECT id, tenant_id, from_actor_id, to_actor_id, status,
             requested_by_user_id, shipped_at, received_at, metadata, created_at, updated_at
      FROM stock_transfers
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, transferId]
    );

    return row ? this.toStockTransfer(row) : null;
  }

  /**
   * Lista transferências por origem
   */
  async listTransfersByFromActor(
    tenantId: string,
    fromActorId: string,
    limit: number = 50
  ): Promise<StockTransfer[]> {
    const rows = await runQueriesWithTenant<StockTransferRow>(
      tenantId,
      `
      SELECT id, tenant_id, from_actor_id, to_actor_id, status,
             requested_by_user_id, shipped_at, received_at, metadata, created_at, updated_at
      FROM stock_transfers
      WHERE tenant_id = $1 AND from_actor_id = $2
      ORDER BY created_at DESC
      LIMIT $3
      `,
      [tenantId, fromActorId, limit]
    );

    return rows.map((row) => this.toStockTransfer(row));
  }

  /**
   * Lista transferências por destino
   */
  async listTransfersByToActor(
    tenantId: string,
    toActorId: string,
    limit: number = 50
  ): Promise<StockTransfer[]> {
    const rows = await runQueriesWithTenant<StockTransferRow>(
      tenantId,
      `
      SELECT id, tenant_id, from_actor_id, to_actor_id, status,
             requested_by_user_id, shipped_at, received_at, metadata, created_at, updated_at
      FROM stock_transfers
      WHERE tenant_id = $1 AND to_actor_id = $2
      ORDER BY created_at DESC
      LIMIT $3
      `,
      [tenantId, toActorId, limit]
    );

    return rows.map((row) => this.toStockTransfer(row));
  }

  /**
   * Atualiza status da transferência
   */
  async updateTransferStatus(
    tenantId: string,
    transferId: string,
    status: StockTransfer['status'],
    shippedAt?: Date,
    receivedAt?: Date
  ): Promise<StockTransfer> {
    const updates: string[] = [`status = $1`];
    const params: any[] = [status];
    let paramIndex = 2;

    if (shippedAt) {
      updates.push(`shipped_at = $${paramIndex}`);
      params.push(shippedAt);
      paramIndex++;
    }

    if (receivedAt) {
      updates.push(`received_at = $${paramIndex}`);
      params.push(receivedAt);
      paramIndex++;
    }

    params.push(tenantId, transferId);

    const row = await runQueryWithTenant<StockTransferRow>(
      tenantId,
      `
      UPDATE stock_transfers
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE tenant_id = $${paramIndex} AND id = $${paramIndex + 1}
      RETURNING id, tenant_id, from_actor_id, to_actor_id, status,
                requested_by_user_id, shipped_at, received_at, metadata, created_at, updated_at
      `,
      params
    );

    if (!row) {
      throw new Error(`Transferência não encontrada: ${transferId}`);
    }

    return this.toStockTransfer(row);
  }

  /**
   * Cria item de transferência
   */
  async createTransferItem(
    tenantId: string,
    transferId: string,
    input: AddStockTransferItemInput
  ): Promise<StockTransferItem> {
    const row = await runQueryWithTenant<StockTransferItemRow>(
      tenantId,
      `
      INSERT INTO stock_transfer_items (
        tenant_id, stock_transfer_id, product_variant_id, quantity, inventory_lot_id, status
      )
      VALUES ($1, $2, $3, $4, $5, 'PENDING')
      RETURNING id, tenant_id, stock_transfer_id, product_variant_id, quantity,
                inventory_lot_id, status, metadata, created_at
      `,
      [
        tenantId,
        transferId,
        input.productVariantId,
        input.quantity,
        input.inventoryLotId || null,
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar item de transferência');
    }

    return this.toStockTransferItem(row);
  }

  /**
   * Lista itens de transferência
   */
  async listTransferItems(
    tenantId: string,
    transferId: string
  ): Promise<StockTransferItem[]> {
    const rows = await runQueriesWithTenant<StockTransferItemRow>(
      tenantId,
      `
      SELECT id, tenant_id, stock_transfer_id, product_variant_id, quantity,
             inventory_lot_id, status, metadata, created_at
      FROM stock_transfer_items
      WHERE tenant_id = $1 AND stock_transfer_id = $2
      ORDER BY created_at ASC
      `,
      [tenantId, transferId]
    );

    return rows.map((row) => this.toStockTransferItem(row));
  }

  /**
   * Busca item por ID
   */
  async getTransferItemById(
    tenantId: string,
    itemId: string
  ): Promise<StockTransferItem | null> {
    const row = await runQueryWithTenant<StockTransferItemRow>(
      tenantId,
      `
      SELECT id, tenant_id, stock_transfer_id, product_variant_id, quantity,
             inventory_lot_id, status, metadata, created_at
      FROM stock_transfer_items
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, itemId]
    );

    return row ? this.toStockTransferItem(row) : null;
  }

  /**
   * Atualiza status do item
   */
  async updateTransferItemStatus(
    tenantId: string,
    itemId: string,
    status: StockTransferItem['status']
  ): Promise<StockTransferItem> {
    const row = await runQueryWithTenant<StockTransferItemRow>(
      tenantId,
      `
      UPDATE stock_transfer_items
      SET status = $1
      WHERE tenant_id = $2 AND id = $3
      RETURNING id, tenant_id, stock_transfer_id, product_variant_id, quantity,
                inventory_lot_id, status, metadata, created_at
      `,
      [status, tenantId, itemId]
    );

    if (!row) {
      throw new Error(`Item de transferência não encontrado: ${itemId}`);
    }

    return this.toStockTransferItem(row);
  }
}

export const stockTransferRepository = new StockTransferRepository();







