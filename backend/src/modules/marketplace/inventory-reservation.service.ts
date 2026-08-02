// backend/src/modules/marketplace/inventory-reservation.service.ts
// SPRINT 43: Service para reservas de estoque

import type { PoolClient } from 'pg';
import { inventoryReservationRepository } from './inventory-reservation.repository';
import { inventoryService } from './inventory.service';
import { logger } from '@core/observability/logger';
import {
  InsufficientStockError,
  type ReserveStockInput,
  type AvailableStock,
  type InventoryReservationSource,
  type InventoryReservation,
} from './inventory-reservation.types';

/**
 * Service para reservas de estoque
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Reserva é lógica, não física
 * - Não altera inventory_movements
 * - Não cria estoque mutável
 * - Append-only (status muda, mas histórico não)
 * - PDV e Marketplace usam o MESMO serviço
 */
class InventoryReservationService {
  private async balanceOnClient(
    client: PoolClient,
    tenantId: string,
    productVariantId: string
  ): Promise<{ quantity: number; unit: string }> {
    const r = await client.query<{ total_quantity: string; unit: string }>(
      `
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN movement_type = 'in' THEN quantity
              WHEN movement_type = 'out' THEN -quantity
              WHEN movement_type = 'adjustment' THEN quantity
            END
          ),
          0
        )::text AS total_quantity,
        COALESCE(MAX(unit), 'un') AS unit
      FROM inventory_movements
      WHERE tenant_id = $1 AND product_variant_id = $2
      `,
      [tenantId, productVariantId]
    );
    const row = r.rows[0];
    return {
      quantity: parseFloat(row?.total_quantity || '0'),
      unit: row?.unit || 'un',
    };
  }

  private async reservedQuantityOnClient(
    client: PoolClient,
    tenantId: string,
    productVariantId: string
  ): Promise<number> {
    const r = await client.query<{ total_reserved: string }>(
      `
      SELECT COALESCE(SUM(quantity), 0)::text AS total_reserved
      FROM inventory_reservations
      WHERE tenant_id = $1
        AND product_variant_id = $2
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())
      `,
      [tenantId, productVariantId]
    );
    return parseFloat(r.rows[0]?.total_reserved || '0');
  }

  private async insertReservationOnClient(
    client: PoolClient,
    tenantId: string,
    input: ReserveStockInput
  ): Promise<InventoryReservation> {
    const r = await client.query<{
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
    }>(
      `
      INSERT INTO inventory_reservations (
        tenant_id, product_variant_id, quantity, order_id, source, status, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, 'active', $6)
      RETURNING id, tenant_id, product_variant_id, quantity, order_id, source,
                status, expires_at, created_at, updated_at
      `,
      [
        tenantId,
        input.productVariantId,
        input.quantity,
        input.orderId,
        input.source,
        input.expiresAt ?? null,
      ]
    );
    const row = r.rows[0];
    if (!row) {
      throw new Error('Erro ao criar reserva de estoque');
    }
    return {
      id: row.id,
      tenantId: row.tenant_id,
      productVariantId: row.product_variant_id,
      quantity: parseFloat(row.quantity),
      orderId: row.order_id,
      source: row.source as InventoryReservation['source'],
      status: row.status as InventoryReservation['status'],
      expiresAt: row.expires_at,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Reserva estoque dentro de uma transação já aberta (mesmo PoolClient).
   * Não chama BEGIN/COMMIT — o caller controla a transação.
   *
   * Usado por order.service.addItem para atomicidade reserva + order_item.
   */
  async reserveStockWithinTransaction(
    client: PoolClient,
    tenantId: string,
    input: ReserveStockInput
  ): Promise<InventoryReservation> {
    await client.query(
      `
      SELECT id FROM product_variants
      WHERE tenant_id = $1 AND id = $2
      FOR UPDATE
      `,
      [tenantId, input.productVariantId]
    );

    const totalBalance = (await this.balanceOnClient(client, tenantId, input.productVariantId))
      .quantity;
    const reservedQuantity = await this.reservedQuantityOnClient(
      client,
      tenantId,
      input.productVariantId
    );
    const availableQuantity = Math.max(0, totalBalance - reservedQuantity);

    if (availableQuantity < input.quantity) {
      throw new InsufficientStockError(
        input.productVariantId,
        availableQuantity,
        input.quantity
      );
    }

    const reservation = await this.insertReservationOnClient(client, tenantId, input);

    return reservation;
  }

  /**
   * Reserva estoque para um pedido
   *
   * Regras:
   * - Verifica saldo disponível antes de reservar
   * - Disponível = saldo_real - reservas_ativas
   * - Se insuficiente → erro claro
   * - Transação única + FOR UPDATE na variante (mesma conexão)
   */
  async reserveStock(
    tenantId: string,
    input: ReserveStockInput
  ): Promise<InventoryReservation> {
    const { getClientWithTenant } = await import('@core/database/pool');
    const client = await getClientWithTenant(tenantId);

    try {
      await client.query('BEGIN');
      const reservation = await this.reserveStockWithinTransaction(client, tenantId, input);
      await client.query('COMMIT');

      logger.info('Stock reservation created', {
        tenantId,
        reservationId: reservation.id,
        productVariantId: input.productVariantId,
        orderId: input.orderId,
        quantity: input.quantity,
      });

      return reservation;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reserva todas as linhas de um pedido numa única transação (locks ordenados por variant).
   */
  async reserveLinesForOrder(
    tenantId: string,
    orderId: string,
    lines: Array<{ productVariantId: string; quantity: number }>,
    source: InventoryReservationSource
  ): Promise<void> {
    const aggregated = new Map<string, number>();
    for (const line of lines) {
      aggregated.set(
        line.productVariantId,
        (aggregated.get(line.productVariantId) ?? 0) + line.quantity
      );
    }
    const sorted = [...aggregated.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    const { getClientWithTenant } = await import('@core/database/pool');
    const client = await getClientWithTenant(tenantId);

    try {
      await client.query('BEGIN');

      for (const [productVariantId, quantity] of sorted) {
        await this.reserveStockWithinTransaction(client, tenantId, {
          productVariantId,
          quantity,
          orderId,
          source,
        });
      }

      await client.query('COMMIT');

      logger.info('Stock reservations created for order', {
        tenantId,
        orderId,
        variantCount: sorted.length,
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Calcula estoque disponível (saldo real - reservas ativas)
   */
  async getAvailableStock(
    tenantId: string,
    productVariantId: string
  ): Promise<AvailableStock> {
    // 1. Buscar saldo real (derivado de movements)
    const balance = await inventoryService.getCurrentBalance(tenantId, productVariantId);
    const totalBalance = balance.quantity;

    // 2. Buscar quantidade reservada (ativa)
    const reservedQuantity = await inventoryReservationRepository.getReservedQuantityByVariant(
      tenantId,
      productVariantId
    );

    // 3. Calcular disponível
    const availableQuantity = Math.max(0, totalBalance - reservedQuantity);

    return {
      productVariantId,
      totalBalance,
      reservedQuantity,
      availableQuantity,
    };
  }

  /**
   * Libera reservas de um pedido
   * 
   * Usado quando:
   * - Pedido CANCELLED
   * - Pedido EXPIRED
   * - Payment FAILED
   */
  async releaseReservation(
    tenantId: string,
    orderId: string
  ) {
    return await inventoryReservationRepository.releaseReservationsByOrder(tenantId, orderId);
  }

  /**
   * Consome reservas de um pedido
   * 
   * Usado quando:
   * - Payment SUCCESS
   * - Estoque deve ser baixado (movement OUT)
   */
  async consumeReservation(
    tenantId: string,
    orderId: string
  ) {
    return await inventoryReservationRepository.consumeReservationsByOrder(tenantId, orderId);
  }

  /**
   * Busca reservas de um pedido
   */
  async getReservationsByOrder(
    tenantId: string,
    orderId: string
  ) {
    return await inventoryReservationRepository.getReservationsByOrder(tenantId, orderId);
  }

  /**
   * Busca reservas ativas por variante
   */
  async getActiveReservationsByVariant(
    tenantId: string,
    productVariantId: string
  ) {
    return await inventoryReservationRepository.getActiveReservationsByVariant(
      tenantId,
      productVariantId
    );
  }

  /**
   * Libera reservas expiradas (para limpeza)
   */
  async releaseExpiredReservations(
    tenantId: string,
    limit: number = 100
  ) {
    const expired = await inventoryReservationRepository.getExpiredReservations(tenantId, limit);
    
    for (const reservation of expired) {
      await inventoryReservationRepository.updateReservationStatus(
        tenantId,
        reservation.id,
        'released'
      );
    }

    return expired.length;
  }
}

export const inventoryReservationService = new InventoryReservationService();

