// backend/src/modules/marketplace/order.repository.ts
// SPRINT 38.1: MARKETPLACE EXECUÇÃO - Order Core
// Repository para pedidos

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  Order,
  CreateOrderInput,
  UpdateOrderInput,
  ListOrdersOptions,
} from './order.types';

interface OrderRow {
  id: string;
  tenant_id: string;
  buyer_actor_id: string;
  seller_actor_id: string;
  status: string;
  total_quantity: string;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

class OrderRepository {
  /**
   * Converte row para Order
   */
  private toOrder(row: OrderRow): Order {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      buyerActorId: row.buyer_actor_id,
      sellerActorId: row.seller_actor_id,
      status: row.status as any,
      totalQuantity: parseFloat(row.total_quantity),
      metadata: row.metadata || null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Cria pedido
   */
  async createOrder(
    tenantId: string,
    input: CreateOrderInput
  ): Promise<Order> {
    const row = await runQueryWithTenant<OrderRow>(
      tenantId,
      `
      INSERT INTO orders (
        tenant_id, buyer_actor_id, seller_actor_id, status, total_quantity, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, tenant_id, buyer_actor_id, seller_actor_id, status,
                total_quantity, metadata, createdAt, updatedAt
      `,
      [
        tenantId,
        input.buyerActorId,
        input.sellerActorId,
        input.status || 'DRAFT',
        0, // total_quantity inicia em 0
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar pedido');
    }

    return this.toOrder(row);
  }

  /**
   * Busca pedido por ID
   */
  async getOrderById(
    tenantId: string,
    orderId: string
  ): Promise<Order | null> {
    const row = await runQueryWithTenant<OrderRow>(
      tenantId,
      `
      SELECT id, tenant_id, buyer_actor_id, seller_actor_id, status,
             total_quantity, metadata, createdAt, updatedAt
      FROM orders
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, orderId]
    );

    return row ? this.toOrder(row) : null;
  }

  /**
   * Lista pedidos
   * SPRINT 52: Paginação padronizada (cursor-based ou offset-based)
   */
  async listOrders(
    tenantId: string,
    options: ListOrdersOptions = {}
  ): Promise<Order[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (options.buyerActorId) {
      conditions.push(`buyer_actor_id = $${paramIndex}`);
      params.push(options.buyerActorId);
      paramIndex++;
    }

    if (options.sellerActorId) {
      conditions.push(`seller_actor_id = $${paramIndex}`);
      params.push(options.sellerActorId);
      paramIndex++;
    }

    if (options.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(options.status);
      paramIndex++;
    }

    // SPRINT 52: Cursor-based pagination
    if (options.cursor) {
      try {
        const cursorDate = new Date(decodeURIComponent(options.cursor));
        conditions.push(`createdAt < $${paramIndex}`);
        params.push(cursorDate);
        paramIndex++;
      } catch (e) {
        // Cursor inválido, ignorar
      }
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    
    // SPRINT 52: Normalizar limite (padrão: 20, máximo: 100)
    const limit = Math.min(Math.max(options.limit || 20, 1), 100);
    const limitClause = `LIMIT ${limit}`;
    const offsetClause = options.offset ? `OFFSET ${options.offset}` : '';

    const rows = await runQueriesWithTenant<OrderRow>(
      tenantId,
      `
      SELECT id, tenant_id, buyer_actor_id, seller_actor_id, status,
             total_quantity, metadata, createdAt, updatedAt
      FROM orders
      ${whereClause}
      ORDER BY createdAt DESC
      ${limitClause}
      ${offsetClause}
      `,
      params
    );

    return rows.map((row) => this.toOrder(row));
  }

  /**
   * Atualiza pedido
   */
  async updateOrder(
    tenantId: string,
    orderId: string,
    input: UpdateOrderInput
  ): Promise<Order> {
    const updates: string[] = [];
    const params: any[] = [tenantId, orderId];
    let paramIndex = 3;

    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      params.push(input.status);
      paramIndex++;
    }

    if (input.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex}`);
      params.push(JSON.stringify(input.metadata));
      paramIndex++;
    }

    if (updates.length === 0) {
      // Nenhuma atualização, retornar pedido atual
      const order = await this.getOrderById(tenantId, orderId);
      if (!order) {
        throw new Error('Pedido não encontrado');
      }
      return order;
    }

    const setClause = updates.join(', ');

    const row = await runQueryWithTenant<OrderRow>(
      tenantId,
      `
      UPDATE orders
      SET ${setClause}
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id, buyer_actor_id, seller_actor_id, status,
                total_quantity, metadata, createdAt, updatedAt
      `,
      params
    );

    if (!row) {
      throw new Error('Pedido não encontrado');
    }

    return this.toOrder(row);
  }

  /**
   * Atualiza total_quantity do pedido (calculado de items)
   */
  async updateTotalQuantity(
    tenantId: string,
    orderId: string,
    totalQuantity: number
  ): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE orders
      SET total_quantity = $1
      WHERE tenant_id = $2 AND id = $3
      `,
      [totalQuantity, tenantId, orderId]
    );
  }
}

export const orderRepository = new OrderRepository();



