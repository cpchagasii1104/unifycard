// backend/src/modules/marketplace/order-item.repository.ts
// SPRINT 38.1: MARKETPLACE EXECUÇÃO - Order Core
// Repository para itens de pedido

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  OrderItem,
  AddOrderItemInput,
  UpdateOrderItemInput,
} from './order.types';

interface OrderItemRow {
  id: string;
  order_id: string;
  product_variant_id: string;
  quantity: string;
  unit: string;
  metadata: any;
  createdAt: Date;
}

class OrderItemRepository {
  /**
   * Converte row para OrderItem
   */
  private toItem(row: OrderItemRow): OrderItem {
    return {
      id: row.id,
      orderId: row.order_id,
      productVariantId: row.product_variant_id,
      quantity: parseFloat(row.quantity),
      unit: row.unit,
      metadata: row.metadata || null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Cria item de pedido
   */
  async createItem(
    tenantId: string,
    orderId: string,
    input: AddOrderItemInput
  ): Promise<OrderItem> {
    const row = await runQueryWithTenant<OrderItemRow>(
      tenantId,
      `
      INSERT INTO order_items (
        order_id, product_variant_id, quantity, unit, metadata
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, order_id, product_variant_id, quantity, unit, metadata, createdAt
      `,
      [
        orderId,
        input.productVariantId,
        input.quantity,
        input.unit || 'un',
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar item');
    }

    return this.toItem(row);
  }

  /**
   * Busca item por ID
   */
  async getItemById(
    tenantId: string,
    itemId: string
  ): Promise<OrderItem | null> {
    const row = await runQueryWithTenant<OrderItemRow>(
      tenantId,
      `
      SELECT oi.id, oi.order_id, oi.product_variant_id, oi.quantity, oi.unit,
             oi.metadata, oi.createdAt
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      WHERE o.tenant_id = $1 AND oi.id = $2
      LIMIT 1
      `,
      [tenantId, itemId]
    );

    return row ? this.toItem(row) : null;
  }

  /**
   * Lista itens de um pedido
   */
  async listItemsByOrder(
    tenantId: string,
    orderId: string
  ): Promise<OrderItem[]> {
    const rows = await runQueriesWithTenant<OrderItemRow>(
      tenantId,
      `
      SELECT oi.id, oi.order_id, oi.product_variant_id, oi.quantity, oi.unit,
             oi.metadata, oi.createdAt
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      WHERE o.tenant_id = $1 AND oi.order_id = $2
      ORDER BY oi.createdAt ASC
      `,
      [tenantId, orderId]
    );

    return rows.map((row) => this.toItem(row));
  }

  /**
   * Atualiza item
   */
  async updateItem(
    tenantId: string,
    itemId: string,
    input: UpdateOrderItemInput
  ): Promise<OrderItem> {
    const updates: string[] = [];
    const params: any[] = [tenantId, itemId];
    let paramIndex = 3;

    if (input.quantity !== undefined) {
      updates.push(`quantity = $${paramIndex}`);
      params.push(input.quantity);
      paramIndex++;
    }

    if (input.unit !== undefined) {
      updates.push(`unit = $${paramIndex}`);
      params.push(input.unit);
      paramIndex++;
    }

    if (input.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex}`);
      params.push(JSON.stringify(input.metadata));
      paramIndex++;
    }

    if (updates.length === 0) {
      // Nenhuma atualização, retornar item atual
      const item = await this.getItemById(tenantId, itemId);
      if (!item) {
        throw new Error('Item não encontrado');
      }
      return item;
    }

    const setClause = updates.join(', ');

    const row = await runQueryWithTenant<OrderItemRow>(
      tenantId,
      `
      UPDATE order_items
      SET ${setClause}
      FROM orders o
      WHERE order_items.id = $2
        AND order_items.order_id = o.id
        AND o.tenant_id = $1
      RETURNING order_items.id, order_items.order_id, order_items.product_variant_id,
                order_items.quantity, order_items.unit, order_items.metadata,
                order_items.createdAt
      `,
      params
    );

    if (!row) {
      throw new Error('Item não encontrado');
    }

    return this.toItem(row);
  }

  /**
   * Remove item
   */
  async removeItem(
    tenantId: string,
    itemId: string
  ): Promise<void> {
    const result = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      DELETE FROM order_items
      USING orders o
      WHERE order_items.id = $2
        AND order_items.order_id = o.id
        AND o.tenant_id = $1
      RETURNING 1
      `,
      [tenantId, itemId]
    );

    if (!result) {
      throw new Error('Item não encontrado');
    }
  }

  /**
   * Calcula total_quantity de um pedido (soma de todos os items)
   */
  async calculateTotalQuantity(
    tenantId: string,
    orderId: string
  ): Promise<number> {
    const result = await runQueryWithTenant<{ totalCents: string }>(
      tenantId,
      `
      SELECT COALESCE(SUM(oi.quantity), 0)::text as total
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      WHERE o.tenant_id = $1 AND oi.order_id = $2
      `,
      [tenantId, orderId]
    );

    return parseFloat(result?.total || '0');
  }
}

export const orderItemRepository = new OrderItemRepository();










