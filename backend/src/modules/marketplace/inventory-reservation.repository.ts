// backend/src/modules/marketplace/inventory-reservation.repository.ts
// SPRINT 43: Repository para reservas de estoque

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
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
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
      expiresAt: row.expiresAt,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
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
        tenant_id, product_variant_id, quantity, order_id, source, status, expiresAt
      )
      VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6)
      RETURNING id, tenant_id, product_variant_id, quantity, order_id, source,
                status, expiresAt, createdAt, updatedAt
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
             status, expiresAt, createdAt, updatedAt
      FROM inventory_reservations
      WHERE tenant_id = $1
        AND product_variant_id = $2
        AND status = 'ACTIVE'
        AND (expiresAt IS NULL OR expiresAt > NOW())
      ORDER BY createdAt ASC
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
        AND (expiresAt IS NULL OR expiresAt > NOW())
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
             status, expiresAt, createdAt, updatedAt
      FROM inventory_reservations
      WHERE tenant_id = $1 AND order_id = $2
      ORDER BY createdAt ASC
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
      SET status = $1, updatedAt = NOW()
      WHERE tenant_id = $2 AND id = $3
      RETURNING id, tenant_id, product_variant_id, quantity, order_id, source,
                status, expiresAt, createdAt, updatedAt
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
      SET status = 'RELEASED', updatedAt = NOW()
      WHERE tenant_id = $1
        AND order_id = $2
        AND status = 'ACTIVE'
      RETURNING id, tenant_id, product_variant_id, quantity, order_id, source,
                status, expiresAt, createdAt, updatedAt
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
      SET status = 'CONSUMED', updatedAt = NOW()
      WHERE tenant_id = $1
        AND order_id = $2
        AND status = 'ACTIVE'
      RETURNING id, tenant_id, product_variant_id, quantity, order_id, source,
                status, expiresAt, createdAt, updatedAt
      `,
      [tenantId, orderId]
    );

    return rows.map((row) => this.toReservation(row));
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
             status, expiresAt, createdAt, updatedAt
      FROM inventory_reservations
      WHERE tenant_id = $1
        AND status = 'ACTIVE'
        AND expiresAt IS NOT NULL
        AND expiresAt <= NOW()
      ORDER BY expiresAt ASC
      LIMIT $2
      `,
      [tenantId, limit]
    );

    return rows.map((row) => this.toReservation(row));
  }
}

export const inventoryReservationRepository = new InventoryReservationRepository();









