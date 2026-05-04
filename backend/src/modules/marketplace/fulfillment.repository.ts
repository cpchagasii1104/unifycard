// backend/src/modules/marketplace/fulfillment.repository.ts
// SPRINT 54: Repository para fulfillment

import type { PoolClient } from 'pg';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  FulfillmentOrder,
  FulfillmentItem,
  CreateFulfillmentOrderInput,
} from './fulfillment.types';

interface FulfillmentOrderRow {
  id: string;
  tenant_id: string;
  order_id: string;
  source: string;
  status: string;
  picked_by_user_id: string | null;
  shipped_at: Date | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

interface FulfillmentItemRow {
  id: string;
  tenant_id: string;
  fulfillment_order_id: string;
  product_variant_id: string;
  quantity: string;
  inventory_lot_id: string | null;
  status: string;
  metadata: any;
  created_at: Date;
}

class FulfillmentRepository {
  /**
   * Converte row para FulfillmentOrder
   */
  private toFulfillmentOrder(row: FulfillmentOrderRow): FulfillmentOrder {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      orderId: row.order_id,
      source: row.source as any,
      status: row.status as any,
      pickedByUserId: row.picked_by_user_id,
      shippedAt: row.shipped_at,
      metadata: row.metadata || null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Converte row para FulfillmentItem
   */
  private toFulfillmentItem(row: FulfillmentItemRow): FulfillmentItem {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      fulfillmentOrderId: row.fulfillment_order_id,
      productVariantId: row.product_variant_id,
      quantity: parseFloat(row.quantity),
      inventoryLotId: row.inventory_lot_id,
      status: row.status as any,
      metadata: row.metadata || null,
      createdAt: row.created_at.toISOString(),
    };
  }

  /**
   * Cria fulfillment order
   */
  async createFulfillmentOrder(
    tenantId: string,
    input: CreateFulfillmentOrderInput
  ): Promise<FulfillmentOrder> {
    const row = await runQueryWithTenant<FulfillmentOrderRow>(
      tenantId,
      `
      INSERT INTO fulfillment_orders (
        tenant_id, order_id, source, status, metadata
      )
      VALUES ($1, $2, $3, 'PENDING', $4)
      RETURNING id, tenant_id, order_id, source, status,
                picked_by_user_id, shipped_at, metadata, created_at, updated_at
      `,
      [
        tenantId,
        input.orderId,
        input.source,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar fulfillment order');
    }

    return this.toFulfillmentOrder(row);
  }

  /**
   * Busca fulfillment order por ID
   */
  async getFulfillmentOrderById(
    tenantId: string,
    fulfillmentOrderId: string
  ): Promise<FulfillmentOrder | null> {
    const row = await runQueryWithTenant<FulfillmentOrderRow>(
      tenantId,
      `
      SELECT id, tenant_id, order_id, source, status,
             picked_by_user_id, shipped_at, metadata, created_at, updated_at
      FROM fulfillment_orders
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, fulfillmentOrderId]
    );

    return row ? this.toFulfillmentOrder(row) : null;
  }

  /**
   * Fulfillment com lock de linha (transação aberta).
   */
  async getFulfillmentOrderByIdForUpdateWithClient(
    client: PoolClient,
    fulfillmentOrderId: string
  ): Promise<FulfillmentOrder | null> {
    const result = await client.query<FulfillmentOrderRow>(
      `
      SELECT id, tenant_id, order_id, source, status,
             picked_by_user_id, shipped_at, metadata, created_at, updated_at
      FROM fulfillment_orders
      WHERE tenant_id = current_setting('app.current_tenant', true)::uuid AND id = $1
      FOR UPDATE
      `,
      [fulfillmentOrderId]
    );
    const row = result.rows[0];
    return row ? this.toFulfillmentOrder(row) : null;
  }

  /**
   * Busca fulfillment order por order ID
   */
  async getFulfillmentOrderByOrderId(
    tenantId: string,
    orderId: string
  ): Promise<FulfillmentOrder | null> {
    const row = await runQueryWithTenant<FulfillmentOrderRow>(
      tenantId,
      `
      SELECT id, tenant_id, order_id, source, status,
             picked_by_user_id, shipped_at, metadata, created_at, updated_at
      FROM fulfillment_orders
      WHERE tenant_id = $1 AND order_id = $2
      LIMIT 1
      `,
      [tenantId, orderId]
    );

    return row ? this.toFulfillmentOrder(row) : null;
  }

  /**
   * Atualiza status do fulfillment order
   */
  async updateFulfillmentStatus(
    tenantId: string,
    fulfillmentOrderId: string,
    status: FulfillmentOrder['status'],
    pickedByUserId?: string,
    shippedAt?: Date
  ): Promise<FulfillmentOrder> {
    const updates: string[] = [`status = $1`];
    const params: any[] = [status];
    let paramIndex = 2;

    if (pickedByUserId) {
      updates.push(`picked_by_user_id = $${paramIndex}`);
      params.push(pickedByUserId);
      paramIndex++;
    }

    if (shippedAt) {
      updates.push(`shipped_at = $${paramIndex}`);
      params.push(shippedAt);
      paramIndex++;
    }

    params.push(tenantId, fulfillmentOrderId);

    const row = await runQueryWithTenant<FulfillmentOrderRow>(
      tenantId,
      `
      UPDATE fulfillment_orders
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE tenant_id = $${paramIndex} AND id = $${paramIndex + 1}
      RETURNING id, tenant_id, order_id, source, status,
                picked_by_user_id, shipped_at, metadata, created_at, updated_at
      `,
      params
    );

    if (!row) {
      throw new Error(`Fulfillment order não encontrado: ${fulfillmentOrderId}`);
    }

    return this.toFulfillmentOrder(row);
  }

  async updateFulfillmentStatusWithClient(
    client: PoolClient,
    fulfillmentOrderId: string,
    status: FulfillmentOrder['status'],
    pickedByUserId?: string,
    shippedAt?: Date
  ): Promise<FulfillmentOrder> {
    const updates: string[] = ['status = $1'];
    const params: any[] = [status];
    let paramIndex = 2;

    if (pickedByUserId) {
      updates.push(`picked_by_user_id = $${paramIndex}`);
      params.push(pickedByUserId);
      paramIndex++;
    }

    if (shippedAt) {
      updates.push(`shipped_at = $${paramIndex}`);
      params.push(shippedAt);
      paramIndex++;
    }

    params.push(fulfillmentOrderId);

    const result = await client.query<FulfillmentOrderRow>(
      `
      UPDATE fulfillment_orders
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE tenant_id = current_setting('app.current_tenant', true)::uuid AND id = $${paramIndex}
      RETURNING id, tenant_id, order_id, source, status,
                picked_by_user_id, shipped_at, metadata, created_at, updated_at
      `,
      params
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error(`Fulfillment order não encontrado: ${fulfillmentOrderId}`);
    }

    return this.toFulfillmentOrder(row);
  }

  /**
   * Cria fulfillment item
   */
  async createFulfillmentItem(
    tenantId: string,
    fulfillmentOrderId: string,
    productVariantId: string,
    quantity: number,
    inventoryLotId?: string
  ): Promise<FulfillmentItem> {
    const row = await runQueryWithTenant<FulfillmentItemRow>(
      tenantId,
      `
      INSERT INTO fulfillment_items (
        tenant_id, fulfillment_order_id, product_variant_id, quantity, inventory_lot_id, status
      )
      VALUES ($1, $2, $3, $4, $5, 'PENDING')
      RETURNING id, tenant_id, fulfillment_order_id, product_variant_id, quantity,
                inventory_lot_id, status, metadata, created_at
      `,
      [tenantId, fulfillmentOrderId, productVariantId, quantity, inventoryLotId || null]
    );

    if (!row) {
      throw new Error('Erro ao criar fulfillment item');
    }

    return this.toFulfillmentItem(row);
  }

  /**
   * Lista itens de fulfillment
   */
  async listFulfillmentItems(
    tenantId: string,
    fulfillmentOrderId: string
  ): Promise<FulfillmentItem[]> {
    const rows = await runQueriesWithTenant<FulfillmentItemRow>(
      tenantId,
      `
      SELECT id, tenant_id, fulfillment_order_id, product_variant_id, quantity,
             inventory_lot_id, status, metadata, created_at
      FROM fulfillment_items
      WHERE tenant_id = $1 AND fulfillment_order_id = $2
      ORDER BY created_at ASC
      `,
      [tenantId, fulfillmentOrderId]
    );

    return rows.map((row) => this.toFulfillmentItem(row));
  }

  async listFulfillmentItemsWithClient(
    client: PoolClient,
    fulfillmentOrderId: string
  ): Promise<FulfillmentItem[]> {
    const result = await client.query<FulfillmentItemRow>(
      `
      SELECT id, tenant_id, fulfillment_order_id, product_variant_id, quantity,
             inventory_lot_id, status, metadata, created_at
      FROM fulfillment_items
      WHERE tenant_id = current_setting('app.current_tenant', true)::uuid
        AND fulfillment_order_id = $1
      ORDER BY created_at ASC
      `,
      [fulfillmentOrderId]
    );
    return result.rows.map((row) => this.toFulfillmentItem(row));
  }

  /**
   * Busca fulfillment item por ID
   */
  async getFulfillmentItemById(
    tenantId: string,
    fulfillmentItemId: string
  ): Promise<FulfillmentItem | null> {
    const row = await runQueryWithTenant<FulfillmentItemRow>(
      tenantId,
      `
      SELECT id, tenant_id, fulfillment_order_id, product_variant_id, quantity,
             inventory_lot_id, status, metadata, created_at
      FROM fulfillment_items
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, fulfillmentItemId]
    );

    return row ? this.toFulfillmentItem(row) : null;
  }

  /**
   * Atualiza status do fulfillment item
   */
  async updateFulfillmentItemStatus(
    tenantId: string,
    fulfillmentItemId: string,
    status: FulfillmentItem['status'],
    inventoryLotId?: string
  ): Promise<FulfillmentItem> {
    const updates: string[] = [`status = $1`];
    const params: any[] = [status];
    let paramIndex = 2;

    if (inventoryLotId) {
      updates.push(`inventory_lot_id = $${paramIndex}`);
      params.push(inventoryLotId);
      paramIndex++;
    }

    params.push(tenantId, fulfillmentItemId);

    const row = await runQueryWithTenant<FulfillmentItemRow>(
      tenantId,
      `
      UPDATE fulfillment_items
      SET ${updates.join(', ')}
      WHERE tenant_id = $${paramIndex} AND id = $${paramIndex + 1}
      RETURNING id, tenant_id, fulfillment_order_id, product_variant_id, quantity,
                inventory_lot_id, status, metadata, created_at
      `,
      params
    );

    if (!row) {
      throw new Error(`Fulfillment item não encontrado: ${fulfillmentItemId}`);
    }

    return this.toFulfillmentItem(row);
  }
}

export const fulfillmentRepository = new FulfillmentRepository();









