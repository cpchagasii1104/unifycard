// backend/src/modules/marketplace/inventory-reservation.repository.ts
// SPRINT 43: Repository para reservas de estoque

import type { PoolClient } from 'pg';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  InventoryReservation,
  ReserveStockInput,
  InventoryReservationStatus,
} from './inventory-reservation.types';

interface InventoryReservationRow {
  id: string;
  tenant_id: string;
  product_variant_id: string;
  quantity: string;
  order_id: string;
  source: string;
  status: string;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

class InventoryReservationRepository {
  /**
   * Converte row para InventoryReservation
   */
  private toReservation(row: InventoryReservationRow): InventoryReservation {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      productVariantId: row.product_variant_id,
      quantity: parseFloat(row.quantity),
      orderId: row.order_id,
      source: row.source as any,
      status: row.status as any,
      expiresAt: row.expires_at,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Cria reserva
   */
  async createReservation(
    tenantId: string,
    input: ReserveStockInput
  ): Promise<InventoryReservation> {
    const row = await runQueryWithTenant<InventoryReservationRow>(
      tenantId,
      `
      INSERT INTO inventory_reservations (
        tenant_id, product_variant_id, quantity, order_id, source, status, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6)
      RETURNING id, tenant_id, product_variant_id, quantity, order_id, source,
                status, expires_at, created_at, updated_at
      `,
      [
        tenantId,
        input.productVariantId,
        input.quantity,
        input.orderId,
        input.source,
        input.expiresAt || null,
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar reserva de estoque');
    }

    return this.toReservation(row);
  }

  /**
   * Busca reservas ativas por variante
   */
  async getActiveReservationsByVariant(
    tenantId: string,
    productVariantId: string
  ): Promise<InventoryReservation[]> {
    const rows = await runQueriesWithTenant<InventoryReservationRow>(
      tenantId,
      `
      SELECT id, tenant_id, product_variant_id, quantity, order_id, source,
             status, expires_at, created_at, updated_at
      FROM inventory_reservations
      WHERE tenant_id = $1
        AND product_variant_id = $2
        AND status = 'ACTIVE'
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at ASC
      `,
      [tenantId, productVariantId]
    );

    return rows.map((row) => this.toReservation(row));
  }

  /**
   * Calcula quantidade reservada (ativa) por variante
   */
  async getReservedQuantityByVariant(
    tenantId: string,
    productVariantId: string
  ): Promise<number> {
    const row = await runQueryWithTenant<{ total_reserved: string }>(
      tenantId,
      `
      SELECT COALESCE(SUM(quantity), 0)::text as total_reserved
      FROM inventory_reservations
      WHERE tenant_id = $1
        AND product_variant_id = $2
        AND status = 'ACTIVE'
        AND (expires_at IS NULL OR expires_at > NOW())
      `,
      [tenantId, productVariantId]
    );

    return parseFloat(row?.total_reserved || '0');
  }

  /**
   * Busca reservas por pedido
   */
  async getReservationsByOrder(
    tenantId: string,
    orderId: string
  ): Promise<InventoryReservation[]> {
    const rows = await runQueriesWithTenant<InventoryReservationRow>(
      tenantId,
      `
      SELECT id, tenant_id, product_variant_id, quantity, order_id, source,
             status, expires_at, created_at, updated_at
      FROM inventory_reservations
      WHERE tenant_id = $1 AND order_id = $2
      ORDER BY created_at ASC
      `,
      [tenantId, orderId]
    );

    return rows.map((row) => this.toReservation(row));
  }

  /**
   * Atualiza status da reserva
   */
  async updateReservationStatus(
    tenantId: string,
    reservationId: string,
    status: InventoryReservationStatus
  ): Promise<InventoryReservation> {
    const row = await runQueryWithTenant<InventoryReservationRow>(
      tenantId,
      `
      UPDATE inventory_reservations
      SET status = $1, updated_at = NOW()
      WHERE tenant_id = $2 AND id = $3
      RETURNING id, tenant_id, product_variant_id, quantity, order_id, source,
                status, expires_at, created_at, updated_at
      `,
      [status, tenantId, reservationId]
    );

    if (!row) {
      throw new Error(`Reserva não encontrada: ${reservationId}`);
    }

    return this.toReservation(row);
  }

  /**
   * Libera todas as reservas de um pedido
   */
  async releaseReservationsByOrder(
    tenantId: string,
    orderId: string
  ): Promise<InventoryReservation[]> {
    const rows = await runQueriesWithTenant<InventoryReservationRow>(
      tenantId,
      `
      UPDATE inventory_reservations
      SET status = 'RELEASED', updated_at = NOW()
      WHERE tenant_id = $1
        AND order_id = $2
        AND status = 'ACTIVE'
      RETURNING id, tenant_id, product_variant_id, quantity, order_id, source,
                status, expires_at, created_at, updated_at
      `,
      [tenantId, orderId]
    );

    return rows.map((row) => this.toReservation(row));
  }

  /**
   * Consome todas as reservas de um pedido
   */
  async consumeReservationsByOrder(
    tenantId: string,
    orderId: string
  ): Promise<InventoryReservation[]> {
    const rows = await runQueriesWithTenant<InventoryReservationRow>(
      tenantId,
      `
      UPDATE inventory_reservations
      SET status = 'CONSUMED', updated_at = NOW()
      WHERE tenant_id = $1
        AND order_id = $2
        AND status = 'ACTIVE'
      RETURNING id, tenant_id, product_variant_id, quantity, order_id, source,
                status, expires_at, created_at, updated_at
      `,
      [tenantId, orderId]
    );

    return rows.map((row) => this.toReservation(row));
  }

  async consumeReservationsByOrderWithClient(
    client: PoolClient,
    orderId: string
  ): Promise<InventoryReservation[]> {
    const result = await client.query<InventoryReservationRow>(
      `
      UPDATE inventory_reservations
      SET status = 'CONSUMED', updated_at = NOW()
      WHERE tenant_id = current_setting('app.current_tenant', true)::uuid
        AND order_id = $1
        AND status = 'ACTIVE'
      RETURNING id, tenant_id, product_variant_id, quantity, order_id, source,
                status, expires_at, created_at, updated_at
      `,
      [orderId]
    );
    return result.rows.map((row) => this.toReservation(row));
  }

  /**
   * Busca reservas expiradas (para limpeza)
   */
  async getExpiredReservations(
    tenantId: string,
    limit: number = 100
  ): Promise<InventoryReservation[]> {
    const rows = await runQueriesWithTenant<InventoryReservationRow>(
      tenantId,
      `
      SELECT id, tenant_id, product_variant_id, quantity, order_id, source,
             status, expires_at, created_at, updated_at
      FROM inventory_reservations
      WHERE tenant_id = $1
        AND status = 'ACTIVE'
        AND expires_at IS NOT NULL
        AND expires_at <= NOW()
      ORDER BY expires_at ASC
      LIMIT $2
      `,
      [tenantId, limit]
    );

    return rows.map((row) => this.toReservation(row));
  }
}

export const inventoryReservationRepository = new InventoryReservationRepository();









