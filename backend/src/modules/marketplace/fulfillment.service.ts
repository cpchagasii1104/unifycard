// backend/src/modules/marketplace/fulfillment.service.ts
// SPRINT 54: FULFILLMENT, PICKING E SAÍDA DE ESTOQUE

import { fulfillmentRepository } from './fulfillment.repository';
import { orderRepository } from './order.repository';
import { orderItemRepository } from './order-item.repository';
import { assertInventoryUnitActorEligible } from './inventory-unit-actor';
import { inventoryService } from './inventory.service';
import { inventoryReservationService } from './inventory-reservation.service';
import { inventoryReservationRepository } from './inventory-reservation.repository';
import { inventoryMovementRepository } from './inventory-movement.repository';
import { productVariantRepository } from './product-variant.repository';
import { inventoryLotRepository } from './inventory-lot.repository';
import type {
  FulfillmentOrder,
  FulfillmentItem,
  CreateFulfillmentOrderInput,
  PickFulfillmentItemInput,
  ShipFulfillmentOrderInput,
} from './fulfillment.types';

/**
 * Service para fulfillment
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Fulfillment controla saída física de estoque
 * - Estoque só é baixado quando SHIPPED
 * - Picking não mexe em estoque
 * - Tudo auditável, tudo explícito
 * - Não inventa economia, não integra transporte
 */
class FulfillmentService {
  /**
   * Cria fulfillment a partir de um pedido
   * 
   * Chamado automaticamente quando payment SUCCESS
   */
  async createFromOrder(
    tenantId: string,
    orderId: string,
    source: 'PDV' | 'MARKETPLACE'
  ): Promise<FulfillmentOrder> {
    // 1. Verificar se já existe fulfillment para este pedido
    const existing = await fulfillmentRepository.getFulfillmentOrderByOrderId(
      tenantId,
      orderId
    );

    if (existing) {
      // Já existe, retornar existente
      return existing;
    }

    // 2. Buscar pedido
    const order = await orderRepository.getOrderById(tenantId, orderId);
    if (!order) {
      throw new Error(`Pedido não encontrado: ${orderId}`);
    }

    // 3. Criar fulfillment order
    const fulfillmentOrder = await fulfillmentRepository.createFulfillmentOrder(
      tenantId,
      {
        orderId,
        source,
        metadata: {
          created_from: 'payment_success',
          createdAt: new Date().toISOString(),
        },
      }
    );

    // 4. Buscar itens do pedido
    const orderItems = await orderItemRepository.listItemsByOrder(tenantId, orderId);

    // 5. Criar fulfillment items para cada item do pedido
    for (const orderItem of orderItems) {
      await fulfillmentRepository.createFulfillmentItem(
        tenantId,
        fulfillmentOrder.id,
        orderItem.productVariantId,
        orderItem.quantity,
        orderItem.metadata?.inventory_lot_id || undefined
      );
    }

    return fulfillmentOrder;
  }

  /**
   * Marca item como PICKED
   * 
   * ⚠️ REGRA: NÃO mexe em estoque ainda
   */
  async pickItem(
    tenantId: string,
    input: PickFulfillmentItemInput
  ): Promise<FulfillmentItem> {
    // 1. Buscar fulfillment item
    const item = await fulfillmentRepository.getFulfillmentItemById(
      tenantId,
      input.fulfillmentItemId
    );

    if (!item) {
      throw new Error(`Fulfillment item não encontrado: ${input.fulfillmentItemId}`);
    }

    if (item.status === 'PICKED') {
      // Já está picked, retornar
      return item;
    }

    // 2. Atualizar status para PICKED
    const updatedItem = await fulfillmentRepository.updateFulfillmentItemStatus(
      tenantId,
      input.fulfillmentItemId,
      'PICKED',
      input.inventoryLotId
    );

    // 3. Atualizar metadata se fornecido
    if (input.metadata) {
      // Por enquanto, apenas log (metadata não é atualizável diretamente)
      // Futuro: adicionar campo metadata atualizável se necessário
    }

    // 4. Verificar se todos os itens estão PICKED
    const fulfillmentOrder = await fulfillmentRepository.getFulfillmentOrderById(
      tenantId,
      item.fulfillmentOrderId
    );

    if (fulfillmentOrder) {
      const allItems = await fulfillmentRepository.listFulfillmentItems(
        tenantId,
        fulfillmentOrder.id
      );

      const allPicked = allItems.every((i) => i.status === 'PICKED');

      if (allPicked && fulfillmentOrder.status === 'PENDING') {
        // Todos os itens estão picked, atualizar status do fulfillment
        await fulfillmentRepository.updateFulfillmentStatus(
          tenantId,
          fulfillmentOrder.id,
          'PICKED',
          input.pickedByUserId
        );
      }
    }

    return updatedItem;
  }

  /**
   * Envia fulfillment (SHIPPED)
   * 
   * ⚠️ REGRA: Aqui sim baixa estoque (inventory_movements OUT)
   */
  async shipFulfillment(
    tenantId: string,
    input: ShipFulfillmentOrderInput
  ): Promise<FulfillmentOrder> {
    const { getClientWithTenant } = await import('@core/database/pool');
    const client = await getClientWithTenant(tenantId);

    try {
      await client.query('BEGIN');

      const fulfillmentOrder = await fulfillmentRepository.getFulfillmentOrderByIdForUpdateWithClient(
        client,
        input.fulfillmentOrderId
      );

      if (!fulfillmentOrder) {
        throw new Error(`Fulfillment order não encontrado: ${input.fulfillmentOrderId}`);
      }

      if (fulfillmentOrder.status === 'SHIPPED') {
        await client.query('COMMIT');
        return fulfillmentOrder;
      }

      if (fulfillmentOrder.status === 'CANCELLED') {
        throw new Error('Fulfillment cancelado não pode ser enviado');
      }

      const items = await fulfillmentRepository.listFulfillmentItemsWithClient(
        client,
        fulfillmentOrder.id
      );

      if (items.length === 0) {
        throw new Error('Fulfillment não tem itens');
      }

      const order = await orderRepository.getOrderById(tenantId, fulfillmentOrder.orderId);
      if (!order) {
        throw new Error(`Pedido não encontrado: ${fulfillmentOrder.orderId}`);
      }
      await assertInventoryUnitActorEligible(tenantId, order.sellerActorId);

      const notPicked = items.filter((item) => item.status !== 'PICKED');
      if (notPicked.length > 0) {
        throw new Error(
          `Não é possível enviar fulfillment: ${notPicked.length} item(ns) ainda não foram separados (PICKED)`
        );
      }

      for (const item of items) {
        const variant = await productVariantRepository.getVariantById(tenantId, item.productVariantId);
        if (!variant) {
          throw new Error(`Variante não encontrada: ${item.productVariantId}`);
        }
        if (item.quantity <= 0) {
          throw new Error(`Quantidade inválida no item ${item.id}`);
        }

        if (item.inventoryLotId) {
          const lot = await inventoryLotRepository.getLotById(tenantId, item.inventoryLotId);
          if (!lot) {
            throw new Error(`Lote não encontrado: ${item.inventoryLotId}`);
          }
          if (lot.productVariantId !== item.productVariantId) {
            throw new Error(
              `Lote pertence a outra variante. Lote: ${lot.productVariantId}, item: ${item.productVariantId}`
            );
          }
        }

        await inventoryMovementRepository.createMovementWithClient(client, {
          actorId: order.sellerActorId,
          productVariantId: item.productVariantId,
          movementType: 'OUT',
          quantity: item.quantity,
          reason: 'FULFILLMENT_SHIPPED',
          referenceType: 'fulfillment_order',
          referenceId: fulfillmentOrder.id,
          inventoryLotId: item.inventoryLotId || undefined,
          metadata: {
            order_id: fulfillmentOrder.orderId,
            fulfillment_item_id: item.id,
            inventory_lot_id: item.inventoryLotId || null,
          },
        });
      }

      await inventoryReservationRepository.consumeReservationsByOrderWithClient(
        client,
        fulfillmentOrder.orderId
      );

      const shippedFulfillment = await fulfillmentRepository.updateFulfillmentStatusWithClient(
        client,
        fulfillmentOrder.id,
        'SHIPPED',
        undefined,
        new Date()
      );

      await client.query('COMMIT');

      {
        const { orderSagaService } = await import('@core/sagas/order-saga.service');
        const { getByOrderId } = await import('@modules/orders/order-saga.repository');
        if (await getByOrderId(tenantId, shippedFulfillment.orderId)) {
          await orderSagaService.advanceSaga(tenantId, shippedFulfillment.orderId, 'fulfilled');
        }
      }

      const variantIds = [...new Set(items.map((i) => i.productVariantId))];
      for (const vid of variantIds) {
        try {
          await inventoryService.recalculateBalance(tenantId, vid);
        } catch (recalcErr) {
          console.warn(`[FulfillmentService] recalculateBalance ${vid}:`, recalcErr);
        }
      }

      return shippedFulfillment;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      const fo = await fulfillmentRepository.getFulfillmentOrderById(tenantId, input.fulfillmentOrderId);
      if (fo) {
        const { orderSagaService } = await import('@core/sagas/order-saga.service');
        const { getByOrderId } = await import('@modules/orders/order-saga.repository');
        const sagaRow = await getByOrderId(tenantId, fo.orderId);
        const terminal = new Set(['failed', 'cancelled', 'fulfilled']);
        if (sagaRow && !terminal.has(String(sagaRow.status))) {
          const msg = err instanceof Error ? err.message : String(err);
          await orderSagaService.failSaga(
            tenantId,
            fo.orderId,
            `fulfillment_ship_failed:${msg.slice(0, 500)}`
          );
        }
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Cancela fulfillment
   * 
   * Libera reservas se ainda não enviado
   */
  async cancelFulfillment(
    tenantId: string,
    orderId: string
  ): Promise<FulfillmentOrder | null> {
    // 1. Buscar fulfillment order
    const fulfillmentOrder = await fulfillmentRepository.getFulfillmentOrderByOrderId(
      tenantId,
      orderId
    );

    if (!fulfillmentOrder) {
      // Não existe fulfillment, retornar null
      return null;
    }

    if (fulfillmentOrder.status === 'SHIPPED') {
      throw new Error('Fulfillment já enviado não pode ser cancelado');
    }

    if (fulfillmentOrder.status === 'CANCELLED') {
      // Já está cancelado, retornar
      return fulfillmentOrder;
    }

    // 2. Liberar reservas de estoque
    try {
      await inventoryReservationService.releaseReservation(tenantId, orderId);
    } catch (releaseError) {
      // Log mas não bloqueia
      console.warn(
        `[FulfillmentService] Erro ao liberar reservas ao cancelar fulfillment para pedido ${orderId}:`,
        releaseError
      );
    }

    // 3. Atualizar status para CANCELLED
    const cancelledFulfillment = await fulfillmentRepository.updateFulfillmentStatus(
      tenantId,
      fulfillmentOrder.id,
      'CANCELLED'
    );

    return cancelledFulfillment;
  }

  /**
   * Busca fulfillment por order ID
   */
  async getFulfillmentByOrderId(
    tenantId: string,
    orderId: string
  ): Promise<FulfillmentOrder | null> {
    return await fulfillmentRepository.getFulfillmentOrderByOrderId(tenantId, orderId);
  }

  /**
   * Lista itens de fulfillment
   */
  async listFulfillmentItems(
    tenantId: string,
    fulfillmentOrderId: string
  ): Promise<FulfillmentItem[]> {
    return await fulfillmentRepository.listFulfillmentItems(tenantId, fulfillmentOrderId);
  }
}

export const fulfillmentService = new FulfillmentService();








