// backend/src/modules/marketplace/stock-transfer.repository.ts
// Transferências — colunas snake_case (migration 0129). Itens sem coluna status.

import type { PoolClient } from 'pg';
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
  metadata: any;
  created_at: Date;
}

class StockTransferRepository {
  private toStockTransfer(row: StockTransferRow): StockTransfer {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      fromActorId: row.from_actor_id,
      toActorId: row.to_actor_id,
      status: row.status as StockTransfer['status'],
      requestedByUserId: row.requested_by_user_id,
      shippedAt: row.shipped_at,
      receivedAt: row.received_at,
      metadata: row.metadata || null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private toStockTransferItem(row: StockTransferItemRow): StockTransferItem {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      stockTransferId: row.stock_transfer_id,
      productVariantId: row.product_variant_id,
      quantity: parseFloat(row.quantity),
      inventoryLotId: row.inventory_lot_id,
      metadata: row.metadata || null,
      createdAt: row.created_at.toISOString(),
    };
  }

  private stSelect = `
      id, tenant_id, from_actor_id, to_actor_id, status,
      requested_by_user_id, shipped_at, received_at, metadata, created_at, updated_at`;

  private stItemSelect = `
      id, tenant_id, stock_transfer_id, product_variant_id, quantity,
      inventory_lot_id, metadata, created_at`;

  async createTransfer(tenantId: string, input: CreateStockTransferInput): Promise<StockTransfer> {
    if (input.fromActorId === input.toActorId) {
      throw new Error('Origem e destino devem ser diferentes');
    }

    const row = await runQueryWithTenant<StockTransferRow>(
      tenantId,
      `
      INSERT INTO stock_transfers (
        tenant_id, from_actor_id, to_actor_id, status, requested_by_user_id, metadata
      )
      VALUES ($1, $2, $3, 'DRAFT', $4, $5::jsonb)
      RETURNING ${this.stSelect}
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

  async getTransferById(tenantId: string, transferId: string): Promise<StockTransfer | null> {
    const row = await runQueryWithTenant<StockTransferRow>(
      tenantId,
      `
      SELECT ${this.stSelect}
      FROM stock_transfers
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, transferId]
    );

    return row ? this.toStockTransfer(row) : null;
  }

  /**
   * Lock de linha dentro de transação (evita dois shipTransfer concorrentes em DRAFT).
   * Requer app.current_tenant no client (ex.: getClientWithTenant).
   */
  async getTransferByIdForUpdateWithClient(
    client: PoolClient,
    transferId: string
  ): Promise<StockTransfer | null> {
    const result = await client.query<StockTransferRow>(
      `
      SELECT ${this.stSelect}
      FROM stock_transfers
      WHERE tenant_id = current_setting('app.current_tenant', true)::uuid AND id = $1
      FOR UPDATE
      `,
      [transferId]
    );
    const row = result.rows[0];
    return row ? this.toStockTransfer(row) : null;
  }

  async listTransfersByFromActor(
    tenantId: string,
    fromActorId: string,
    limit: number = 50
  ): Promise<StockTransfer[]> {
    const rows = await runQueriesWithTenant<StockTransferRow>(
      tenantId,
      `
      SELECT ${this.stSelect}
      FROM stock_transfers
      WHERE tenant_id = $1 AND from_actor_id = $2
      ORDER BY created_at DESC
      LIMIT $3
      `,
      [tenantId, fromActorId, limit]
    );

    return rows.map((row) => this.toStockTransfer(row));
  }

  async listTransfersByToActor(
    tenantId: string,
    toActorId: string,
    limit: number = 50
  ): Promise<StockTransfer[]> {
    const rows = await runQueriesWithTenant<StockTransferRow>(
      tenantId,
      `
      SELECT ${this.stSelect}
      FROM stock_transfers
      WHERE tenant_id = $1 AND to_actor_id = $2
      ORDER BY created_at DESC
      LIMIT $3
      `,
      [tenantId, toActorId, limit]
    );

    return rows.map((row) => this.toStockTransfer(row));
  }

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
      RETURNING ${this.stSelect}
      `,
      params
    );

    if (!row) {
      throw new Error(`Transferência não encontrada: ${transferId}`);
    }

    return this.toStockTransfer(row);
  }

  async updateTransferStatusWithClient(
    client: PoolClient,
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

    params.push(transferId);

    const result = await client.query<StockTransferRow>(
      `
      UPDATE stock_transfers
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE tenant_id = current_setting('app.current_tenant', true)::uuid AND id = $${paramIndex}
      RETURNING ${this.stSelect}
      `,
      params
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error(`Transferência não encontrada: ${transferId}`);
    }

    return this.toStockTransfer(row);
  }

  async createTransferItem(
    tenantId: string,
    transferId: string,
    input: AddStockTransferItemInput
  ): Promise<StockTransferItem> {
    const row = await runQueryWithTenant<StockTransferItemRow>(
      tenantId,
      `
      INSERT INTO stock_transfer_items (
        tenant_id, stock_transfer_id, product_variant_id, quantity, inventory_lot_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      RETURNING ${this.stItemSelect}
      `,
      [
        tenantId,
        transferId,
        input.productVariantId,
        input.quantity,
        input.inventoryLotId || null,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar item de transferência');
    }

    return this.toStockTransferItem(row);
  }

  async listTransferItems(tenantId: string, transferId: string): Promise<StockTransferItem[]> {
    const rows = await runQueriesWithTenant<StockTransferItemRow>(
      tenantId,
      `
      SELECT ${this.stItemSelect}
      FROM stock_transfer_items
      WHERE tenant_id = $1 AND stock_transfer_id = $2
      ORDER BY created_at ASC
      `,
      [tenantId, transferId]
    );

    return rows.map((row) => this.toStockTransferItem(row));
  }

  async listTransferItemsWithClient(
    client: PoolClient,
    transferId: string
  ): Promise<StockTransferItem[]> {
    const result = await client.query<StockTransferItemRow>(
      `
      SELECT ${this.stItemSelect}
      FROM stock_transfer_items
      WHERE tenant_id = current_setting('app.current_tenant', true)::uuid
        AND stock_transfer_id = $1
      ORDER BY created_at ASC
      `,
      [transferId]
    );
    return result.rows.map((row) => this.toStockTransferItem(row));
  }

  async getTransferItemById(tenantId: string, itemId: string): Promise<StockTransferItem | null> {
    const row = await runQueryWithTenant<StockTransferItemRow>(
      tenantId,
      `
      SELECT ${this.stItemSelect}
      FROM stock_transfer_items
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, itemId]
    );

    return row ? this.toStockTransferItem(row) : null;
  }
}

export const stockTransferRepository = new StockTransferRepository();
