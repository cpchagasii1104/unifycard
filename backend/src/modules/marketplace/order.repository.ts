// backend/src/modules/marketplace/order.repository.ts
// SPRINT 38.1: MARKETPLACE EXECUÇÃO - Order Core
// Repository para pedidos

import type { PoolClient } from 'pg';
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
  created_at: Date;
  updated_at: Date;
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
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
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
        tenant_id, buyer_actor_id, seller_actor_id, status, total_quantity, total_cents, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, tenant_id, buyer_actor_id, seller_actor_id, status,
                total_quantity, metadata, created_at, updated_at
      `,
      [
        tenantId,
        input.buyerActorId,
        input.sellerActorId,
        input.status || 'draft',
        0, // total_quantity inicia em 0
        1, // total_cents: placeholder mínimo (CHECK > 0) até pricing/total monetário
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar pedido');
    }

    return this.toOrder(row);
  }

  /**
   * Cria pedido no mesmo PoolClient (transação aberta). Requer app.current_tenant no client.
   */
  async createOrderWithClient(
    client: PoolClient,
    tenantId: string,
    input: CreateOrderInput
  ): Promise<Order> {
    const result = await client.query<OrderRow>(
      `
      INSERT INTO orders (
        tenant_id, buyer_actor_id, seller_actor_id, status, total_quantity, total_cents, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, tenant_id, buyer_actor_id, seller_actor_id, status,
                total_quantity, metadata, created_at, updated_at
      `,
      [
        tenantId,
        input.buyerActorId,
        input.sellerActorId,
        input.status || 'draft',
        0,
        1,
        JSON.stringify(input.metadata || {}),
      ]
    );
    const row = result.rows[0];
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
             total_quantity, metadata, created_at, updated_at
      FROM orders
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, orderId]
    );

    return row ? this.toOrder(row) : null;
  }

  /**
   * Pedido com bloqueio de linha (transação aberta). Requer app.current_tenant no client.
   */
  async getOrderByIdForUpdateWithClient(
    client: PoolClient,
    orderId: string
  ): Promise<Order | null> {
    const result = await client.query<OrderRow>(
      `
      SELECT id, tenant_id, buyer_actor_id, seller_actor_id, status,
             total_quantity, metadata, created_at, updated_at
      FROM orders
      WHERE tenant_id = current_setting('app.current_tenant', true)::uuid AND id = $1
      FOR UPDATE
      LIMIT 1
      `,
      [orderId]
    );
    const row = result.rows[0];
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
        conditions.push(`created_at < $${paramIndex}`);
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
             total_quantity, metadata, created_at, updated_at
      FROM orders
      ${whereClause}
      ORDER BY created_at DESC
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
                total_quantity, metadata, created_at, updated_at
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

  async updateTotalQuantityWithClient(
    client: PoolClient,
    orderId: string,
    totalQuantity: number
  ): Promise<void> {
    await client.query(
      `
      UPDATE orders
      SET total_quantity = $1
      WHERE tenant_id = current_setting('app.current_tenant', true)::uuid AND id = $2
      `,
      [totalQuantity, orderId]
    );
  }
}

export const orderRepository = new OrderRepository();



