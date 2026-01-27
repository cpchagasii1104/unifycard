// backend/src/modules/marketplace/inventory-reservation.service.ts
// SPRINT 43: Service para reservas de estoque

import { inventoryReservationRepository } from './inventory-reservation.repository';
import { inventoryService } from './inventory.service';
import { logger } from '@core/observability/logger';
import type {
  ReserveStockInput,
  AvailableStock,
  InventoryReservationSource,
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
  /**
   * Reserva estoque para um pedido
   * 
   * Regras:
   * - Verifica saldo disponível antes de reservar
   * - Disponível = saldo_real - reservas_ativas
   * - Se insuficiente → erro claro
   * - SPRINT 52: Usa SELECT FOR UPDATE para garantir concorrência segura
   */
  async reserveStock(
    tenantId: string,
    input: ReserveStockInput
  ) {
    const { getClientWithTenant } = await import('@core/database/pool');
    const client = await getClientWithTenant(tenantId);

    try {
      // SPRINT 52: Iniciar transação com lock para concorrência segura
      await client.query('BEGIN');

      // 1. Lock na variante para evitar race condition
      await client.query(
        `
        SELECT id FROM product_variants
        WHERE tenant_id = $1 AND id = $2
        FOR UPDATE
        `,
        [tenantId, input.productVariantId]
      );

      // 2. Calcular saldo disponível (com lock)
      const balance = await inventoryService.getCurrentBalance(tenantId, input.productVariantId);
      const totalBalance = balance?.currentQuantity || 0;

      // 3. Calcular quantidade reservada (ativa) - dentro da transação
      const reservedQuantity = await inventoryReservationRepository.getReservedQuantityByVariant(
        tenantId,
        input.productVariantId
      );

      // 4. Calcular disponível
      const availableQuantity = Math.max(0, totalBalance - reservedQuantity);

      // 5. Verificar se há estoque suficiente
      if (availableQuantity < input.quantity) {
        await client.query('ROLLBACK');
        throw new Error(
          `Estoque insuficiente. Disponível: ${availableQuantity}, Solicitado: ${input.quantity}`
        );
      }

      // 6. Criar reserva (dentro da transação)
      const reservation = await inventoryReservationRepository.createReservation(tenantId, input);

      // 7. Commit
      await client.query('COMMIT');

      // SPRINT 52: Log estruturado
      logger.info('Stock reservation created', {
        tenantId,
        reservationId: reservation.id,
        productVariantId: input.productVariantId,
        orderId: input.orderId,
        quantity: input.quantity,
        availableQuantity,
        totalBalance,
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
   * Calcula estoque disponível (saldo real - reservas ativas)
   */
  async getAvailableStock(
    tenantId: string,
    productVariantId: string
  ): Promise<AvailableStock> {
    // 1. Buscar saldo real (derivado de movements)
    const balance = await inventoryService.getCurrentBalance(tenantId, productVariantId);
    const totalBalance = balance?.currentQuantity || 0;

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
        'RELEASED'
      );
    }

    return expired.length;
  }
}

export const inventoryReservationService = new InventoryReservationService();

