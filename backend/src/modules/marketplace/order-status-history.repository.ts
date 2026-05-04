// backend/src/modules/marketplace/order-status-history.repository.ts
// SPRINT 38.2: MARKETPLACE EXECUÇÃO - Order Lifecycle
// Repository para histórico de status de pedidos

import type { PoolClient } from 'pg';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { OrderStatusHistory } from './order.types';

interface OrderStatusHistoryRow {
  id: string;
  order_id: string;
  from_status: string | null;
  to_status: string;
  changed_by_user_id: string | null;
  reason: string | null;
  created_at: Date;
}

class OrderStatusHistoryRepository {
  /**
   * Converte row para OrderStatusHistory
   */
  private toHistory(row: OrderStatusHistoryRow): OrderStatusHistory {
    return {
      id: row.id,
      orderId: row.order_id,
      fromStatus: row.from_status as any,
      toStatus: row.to_status as any,
      changedByUserId: row.changed_by_user_id,
      reason: row.reason,
      createdAt: row.created_at.toISOString(),
    };
  }

  /**
   * Registra mudança de status
   */
  async recordStatusChange(
    tenantId: string,
    orderId: string,
    fromStatus: string | null,
    toStatus: string,
    changedByUserId?: string | null,
    reason?: string | null
  ): Promise<OrderStatusHistory> {
    const row = await runQueryWithTenant<OrderStatusHistoryRow>(
      tenantId,
      `
      INSERT INTO order_status_history (
        order_id, from_status, to_status, changed_by_user_id, reason
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, order_id, from_status, to_status, changed_by_user_id,
                reason, created_at
      `,
      [orderId, fromStatus, toStatus, changedByUserId || null, reason || null]
    );

    if (!row) {
      throw new Error('Erro ao registrar histórico de status');
    }

    return this.toHistory(row);
  }

  /**
   * Registra mudança de status no mesmo PoolClient (transação aberta).
   */
  async recordStatusChangeWithClient(
    client: PoolClient,
    orderId: string,
    fromStatus: string | null,
    toStatus: string,
    changedByUserId?: string | null,
    reason?: string | null
  ): Promise<OrderStatusHistory> {
    const result = await client.query<OrderStatusHistoryRow>(
      `
      INSERT INTO order_status_history (
        order_id, from_status, to_status, changed_by_user_id, reason
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, order_id, from_status, to_status, changed_by_user_id,
                reason, created_at
      `,
      [orderId, fromStatus, toStatus, changedByUserId || null, reason || null]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('Erro ao registrar histórico de status');
    }
    return this.toHistory(row);
  }

  /**
   * Lista histórico de um pedido
   */
  async getHistoryByOrder(
    tenantId: string,
    orderId: string
  ): Promise<OrderStatusHistory[]> {
    const rows = await runQueriesWithTenant<OrderStatusHistoryRow>(
      tenantId,
      `
      SELECT osh.id, osh.order_id, osh.from_status, osh.to_status,
             osh.changed_by_user_id, osh.reason, osh.created_at
      FROM order_status_history osh
      INNER JOIN orders o ON osh.order_id = o.id
      WHERE o.tenant_id = $1 AND osh.order_id = $2
      ORDER BY osh.created_at ASC
      `,
      [tenantId, orderId]
    );

    return rows.map((row) => this.toHistory(row));
  }

  /**
   * Busca última mudança de status de um pedido
   */
  async getLastStatusChange(
    tenantId: string,
    orderId: string
  ): Promise<OrderStatusHistory | null> {
    const row = await runQueryWithTenant<OrderStatusHistoryRow>(
      tenantId,
      `
      SELECT osh.id, osh.order_id, osh.from_status, osh.to_status,
             osh.changed_by_user_id, osh.reason, osh.created_at
      FROM order_status_history osh
      INNER JOIN orders o ON osh.order_id = o.id
      WHERE o.tenant_id = $1 AND osh.order_id = $2
      ORDER BY osh.created_at DESC
      LIMIT 1
      `,
      [tenantId, orderId]
    );

    return row ? this.toHistory(row) : null;
  }
}

export const orderStatusHistoryRepository = new OrderStatusHistoryRepository();









