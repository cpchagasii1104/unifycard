// backend/src/modules/marketplace/order.service.ts
// SPRINT 38.1: MARKETPLACE EXECUÇÃO - Order Core
// SPRINT 38.2: MARKETPLACE EXECUÇÃO - Order Lifecycle
// Service para pedidos

import { orderRepository } from './order.repository';
import { orderItemRepository } from './order-item.repository';
import { orderStatusHistoryRepository } from './order-status-history.repository';
import { productRepository } from './product.repository';
import { productVariantRepository } from './product-variant.repository';
import type {
  Order,
  OrderItem,
  OrderStatusHistory,
  CreateOrderInput,
  UpdateOrderInput,
  ListOrdersOptions,
  AddOrderItemInput,
  UpdateOrderItemInput,
  ChangeOrderStatusInput,
  OrderStatus,
} from './order.types';

/**
 * Service para pedidos
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Order representa intenção estruturada, não execução
 * - Não calcula preço
 * - Não baixa estoque
 * - Não integra com Bank ou pagamento
 * - Só pode adicionar/remover item em DRAFT
 * - Submit apenas muda status
 * - Cancel não executa rollback
 * - Transições de status são validadas e registradas no histórico
 */
class OrderService {
  /**
   * Transições permitidas de status
   * 
   * Regras:
   * - DRAFT → SUBMITTED
   * - DRAFT → CANCELLED
   * - SUBMITTED → CANCELLED
   * - SUBMITTED → EXPIRED
   * - EXPIRED nunca volta
   * - CANCELLED nunca volta
   */
  private readonly ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    draft: ['submitted', 'cancelled'],
    submitted: ['cancelled', 'expired'],
    cancelled: [], // Nunca volta
    expired: [], // Nunca volta
  };

  /**
   * Valida se transição de status é permitida
   */
  private validateStatusTransition(
    fromStatus: OrderStatus,
    toStatus: OrderStatus
  ): void {
    const allowed = this.ALLOWED_TRANSITIONS[fromStatus];

    if (!allowed.includes(toStatus)) {
      throw new Error(
        `Transição de status inválida: ${fromStatus} → ${toStatus}. Transições permitidas: ${allowed.join(', ') || 'nenhuma'}`
      );
    }
  }

  /**
   * Muda status do pedido (centralizado)
   * 
   * Valida transição e registra histórico
   */
  private async changeOrderStatus(
    tenantId: string,
    orderId: string,
    input: ChangeOrderStatusInput
  ): Promise<Order> {
    // Buscar pedido atual
    const order = await orderRepository.getOrderById(tenantId, orderId);

    if (!order) {
      throw new Error(`Pedido não encontrado: ${orderId}`);
    }

    // Validar transição
    this.validateStatusTransition(order.status, input.toStatus);

    // Atualizar status
    const updatedOrder = await orderRepository.updateOrder(tenantId, orderId, {
      status: input.toStatus,
    });

    // Registrar histórico (append-only)
    await orderStatusHistoryRepository.recordStatusChange(
      tenantId,
      orderId,
      order.status,
      input.toStatus,
      input.changedByUserId,
      input.reason
    );

    return updatedOrder;
  }
  /**
   * Cria pedido
   */
  async createOrder(
    tenantId: string,
    input: CreateOrderInput,
    createdByUserId?: string
  ): Promise<Order> {
    const order = await orderRepository.createOrder(tenantId, input);

    // Registrar histórico inicial (status DRAFT)
    await orderStatusHistoryRepository.recordStatusChange(
      tenantId,
      order.id,
      null, // Primeira mudança (não tem from_status)
      order.status,
      createdByUserId,
      'Pedido criado'
    );

    return order;
  }

  /**
   * Cria pedido DRAFT + itens + reservas numa única transação (intent execute / batch).
   * Não altera {@link addItem} nem fluxos PDV/REST por item.
   */
  async createOrderWithItemsAndReservations(
    tenantId: string,
    createInput: CreateOrderInput,
    lines: AddOrderItemInput[],
    source: 'MARKETPLACE' | 'PDV' = 'MARKETPLACE',
    createdByUserId?: string
  ): Promise<{ order: Order; items: OrderItem[] }> {
    if (!lines.length) {
      throw new Error('Pedido sem itens');
    }

    const { productVariantRepository } = await import('./product-variant.repository');
    const { productRepository } = await import('./product.repository');
    const { pricingService } = await import('./pricing.service');

    type Prepared = { input: AddOrderItemInput };
    const prepared: Prepared[] = [];

    for (const line of lines) {
      const variant = await productVariantRepository.getVariantById(
        tenantId,
        line.productVariantId
      );
      if (!variant) {
        throw new Error(`Variante não encontrada: ${line.productVariantId}`);
      }

      const product = await productRepository.getProductById(tenantId, variant.productId);
      if (!product) {
        throw new Error(`Produto não encontrado: ${variant.productId}`);
      }
      const priceBreakdown = await pricingService.getCurrentPrice(tenantId, {
        variantId: line.productVariantId,
        productId: product.id,
        categoryId: product.categoryId || undefined,
        quantity: line.quantity,
      });
      const priceSnapshot: Record<string, unknown> = {
        basePrice: priceBreakdown.basePrice,
        discountAmount: priceBreakdown.discountAmount,
        finalPrice: priceBreakdown.finalPrice,
        currency: priceBreakdown.currency,
        promotions: priceBreakdown.promotions,
        resolvedAt: new Date().toISOString(),
      };

      prepared.push({
        input: {
          ...line,
          metadata: {
            ...line.metadata,
            priceSnapshot,
          },
        },
      });
    }

    const sorted = [...prepared].sort((a, b) =>
      a.input.productVariantId.localeCompare(b.input.productVariantId)
    );

    const { getClientWithTenant } = await import('@core/database/pool');
    const { inventoryReservationService } = await import('./inventory-reservation.service');
    const client = await getClientWithTenant(tenantId);

    try {
      await client.query('BEGIN');

      const order = await orderRepository.createOrderWithClient(client, tenantId, createInput);

      await orderStatusHistoryRepository.recordStatusChangeWithClient(
        client,
        order.id,
        null,
        order.status,
        createdByUserId ?? null,
        'Pedido criado'
      );

      const orderLocked = await orderRepository.getOrderByIdForUpdateWithClient(client, order.id);
      if (!orderLocked || orderLocked.status !== 'draft') {
        throw new Error('Pedido inválido após criação');
      }

      const items: OrderItem[] = [];
      for (const { input } of sorted) {
        await inventoryReservationService.reserveStockWithinTransaction(client, tenantId, {
          productVariantId: input.productVariantId,
          quantity: input.quantity,
          orderId: order.id,
          source: source as any,
        });
        const item = await orderItemRepository.createItemWithClient(client, tenantId, order.id, input);
        items.push(item);
      }

      const totalQuantity = await orderItemRepository.calculateTotalQuantityWithClient(
        client,
        order.id
      );
      await orderRepository.updateTotalQuantityWithClient(client, order.id, totalQuantity);

      await client.query('COMMIT');

      const finalOrder = await orderRepository.getOrderById(tenantId, order.id);
      if (!finalOrder) {
        throw new Error('Pedido não encontrado após commit');
      }

      const { orderSagaService } = await import('@core/sagas/order-saga.service');
      await orderSagaService.startSaga(tenantId, finalOrder.id);

      return { order: finalOrder, items };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Busca pedido por ID
   */
  async getOrderById(
    tenantId: string,
    orderId: string
  ): Promise<Order | null> {
    return await orderRepository.getOrderById(tenantId, orderId);
  }

  /**
   * Lista pedidos
   */
  async listOrders(
    tenantId: string,
    options: ListOrdersOptions = {}
  ): Promise<Order[]> {
    return await orderRepository.listOrders(tenantId, options);
  }

  /**
   * Adiciona item ao pedido
   * 
   * Regras:
   * - Só pode adicionar item em DRAFT
   * - Valida se variante existe
   * - Valida unidade (leve)
   * - SPRINT 43: Reserva estoque antes de adicionar item
   */
  async addItem(
    tenantId: string,
    orderId: string,
    input: AddOrderItemInput,
    source: 'MARKETPLACE' | 'PDV' = 'MARKETPLACE'
  ): Promise<OrderItem> {
    // Verificar se pedido existe e está em DRAFT
    const order = await orderRepository.getOrderById(tenantId, orderId);

    if (!order) {
      throw new Error(`Pedido não encontrado: ${orderId}`);
    }

    if (order.status !== 'draft') {
      throw new Error(
        `Não é possível adicionar item. Pedido está em status ${order.status}. Apenas draft permite edição.`
      );
    }

    // Verificar se variante existe
    const variant = await productVariantRepository.getVariantById(
      tenantId,
      input.productVariantId
    );

    if (!variant) {
      throw new Error(`Variante não encontrada: ${input.productVariantId}`);
    }

    // SPRINT 48: Resolver preço antes da transação (menor tempo de lock em `orders`)
    const { pricingService } = await import('./pricing.service');
    const product = await productRepository.getProductById(tenantId, variant.productId);
    if (!product) {
      throw new Error(`Produto não encontrado: ${variant.productId}`);
    }
    const priceBreakdown = await pricingService.getCurrentPrice(tenantId, {
      variantId: input.productVariantId,
      productId: product.id,
      categoryId: product.categoryId || undefined,
      quantity: input.quantity,
    });
    const priceSnapshot = {
      basePrice: priceBreakdown.basePrice,
      discountAmount: priceBreakdown.discountAmount,
      finalPrice: priceBreakdown.finalPrice,
      currency: priceBreakdown.currency,
      promotions: priceBreakdown.promotions,
      resolvedAt: new Date().toISOString(),
    };

    const itemInput = {
      ...input,
      metadata: {
        ...input.metadata,
        priceSnapshot,
      },
    };

    // Reserva + linha de pedido + total_quantity na mesma transação (evita reserva órfã)
    const { getClientWithTenant } = await import('@core/database/pool');
    const { inventoryReservationService } = await import('./inventory-reservation.service');
    const client = await getClientWithTenant(tenantId);

    try {
      await client.query('BEGIN');

      const orderLocked = await orderRepository.getOrderByIdForUpdateWithClient(client, orderId);
      if (!orderLocked) {
        throw new Error(`Pedido não encontrado: ${orderId}`);
      }
      if (orderLocked.status !== 'draft') {
        throw new Error(
          `Não é possível adicionar item. Pedido está em status ${orderLocked.status}. Apenas draft permite edição.`
        );
      }

      await inventoryReservationService.reserveStockWithinTransaction(client, tenantId, {
        productVariantId: input.productVariantId,
        quantity: input.quantity,
        orderId,
        source: source as any,
      });

      const item = await orderItemRepository.createItemWithClient(client, tenantId, orderId, itemInput);

      const totalQuantity = await orderItemRepository.calculateTotalQuantityWithClient(client, orderId);
      await orderRepository.updateTotalQuantityWithClient(client, orderId, totalQuantity);

      await client.query('COMMIT');
      return item;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Remove item do pedido
   * 
   * Regras:
   * - Só pode remover item em DRAFT
   */
  async removeItem(
    tenantId: string,
    orderId: string,
    itemId: string
  ): Promise<void> {
    // Verificar se pedido existe e está em DRAFT
    const order = await orderRepository.getOrderById(tenantId, orderId);

    if (!order) {
      throw new Error(`Pedido não encontrado: ${orderId}`);
    }

    if (order.status !== 'draft') {
      throw new Error(
        `Não é possível remover item. Pedido está em status ${order.status}. Apenas draft permite edição.`
      );
    }

    // Verificar se item existe e pertence ao pedido
    const item = await orderItemRepository.getItemById(tenantId, itemId);

    if (!item) {
      throw new Error(`Item não encontrado: ${itemId}`);
    }

    if (item.orderId !== orderId) {
      throw new Error(`Item não pertence ao pedido: ${itemId}`);
    }

    // Remover item
    await orderItemRepository.removeItem(tenantId, itemId);

    // Atualizar total_quantity do pedido
    const totalQuantity = await orderItemRepository.calculateTotalQuantity(
      tenantId,
      orderId
    );
    await orderRepository.updateTotalQuantity(tenantId, orderId, totalQuantity);
  }

  /**
   * Lista itens de um pedido
   */
  async listItems(
    tenantId: string,
    orderId: string
  ): Promise<OrderItem[]> {
    // Verificar se pedido existe
    const order = await orderRepository.getOrderById(tenantId, orderId);

    if (!order) {
      throw new Error(`Pedido não encontrado: ${orderId}`);
    }

    return await orderItemRepository.listItemsByOrder(tenantId, orderId);
  }

  /**
   * Envia pedido (submit)
   * 
   * Regras:
   * - Apenas muda status para SUBMITTED
   * - Não executa nenhuma ação (não baixa estoque, não processa pagamento)
   * - Valida transição e registra histórico
   */
  async submitOrder(
    tenantId: string,
    orderId: string,
    changedByUserId?: string,
    reason?: string
  ): Promise<Order> {
    // Verificar se pedido existe
    const order = await orderRepository.getOrderById(tenantId, orderId);

    if (!order) {
      throw new Error(`Pedido não encontrado: ${orderId}`);
    }

    // Verificar se pedido tem itens
    const items = await orderItemRepository.listItemsByOrder(tenantId, orderId);

    if (items.length === 0) {
      throw new Error('Pedido não pode ser enviado sem itens');
    }

    // Mudar status (valida transição e registra histórico)
    return await this.changeOrderStatus(tenantId, orderId, {
      toStatus: 'submitted',
      changedByUserId,
      reason: reason || 'Pedido enviado',
    });
  }

  /**
   * Cancela pedido
   * 
   * Regras:
   * - Apenas muda status para CANCELLED
   * - Não executa rollback de nada (não reverte estoque, não reverte pagamento)
   * - Valida transição e registra histórico
   * - SPRINT 43: Libera reservas de estoque
   */
  async cancelOrder(
    tenantId: string,
    orderId: string,
    changedByUserId?: string,
    reason?: string
  ): Promise<Order> {
    const orderBefore = await orderRepository.getOrderById(tenantId, orderId);
    // SPRINT 43: Liberar reservas antes de cancelar
    const { inventoryReservationService } = await import('./inventory-reservation.service');
    try {
      await inventoryReservationService.releaseReservation(tenantId, orderId);
    } catch (releaseError) {
      // Log mas não bloqueia cancelamento
      console.warn(`[OrderService] Erro ao liberar reservas ao cancelar pedido ${orderId}:`, releaseError);
    }

    // Mudar status (valida transição e registra histórico)
    const cancelled = await this.changeOrderStatus(tenantId, orderId, {
      toStatus: 'cancelled',
      changedByUserId,
      reason: reason || 'Pedido cancelado',
    });
    if (orderBefore?.buyerActorId) {
      const { recordActorRiskEventAsync } = await import('@modules/risk-identity/risk-hooks');
      recordActorRiskEventAsync(tenantId, orderBefore.buyerActorId, 'cancellation_requested', orderId, {
        reason: (reason || 'cancelled').slice(0, 500),
      });
    }
    return cancelled;
  }

  /**
   * Expira pedido
   * 
   * Regras:
   * - Apenas muda status para EXPIRED
   * - Não executa nenhuma ação
   * - Valida transição e registra histórico
   * - SPRINT 43: Libera reservas de estoque
   */
  async expireOrder(
    tenantId: string,
    orderId: string,
    changedByUserId?: string,
    reason?: string
  ): Promise<Order> {
    // SPRINT 43: Liberar reservas antes de expirar
    const { inventoryReservationService } = await import('./inventory-reservation.service');
    try {
      await inventoryReservationService.releaseReservation(tenantId, orderId);
    } catch (releaseError) {
      // Log mas não bloqueia expiração
      console.warn(`[OrderService] Erro ao liberar reservas ao expirar pedido ${orderId}:`, releaseError);
    }

    // Mudar status (valida transição e registra histórico)
    return await this.changeOrderStatus(tenantId, orderId, {
      toStatus: 'expired',
      changedByUserId,
      reason: reason || 'Pedido expirado',
    });
  }

  /**
   * Lista histórico de status de um pedido
   */
  async getStatusHistory(
    tenantId: string,
    orderId: string
  ): Promise<OrderStatusHistory[]> {
    // Verificar se pedido existe
    const order = await orderRepository.getOrderById(tenantId, orderId);

    if (!order) {
      throw new Error(`Pedido não encontrado: ${orderId}`);
    }

    return await orderStatusHistoryRepository.getHistoryByOrder(
      tenantId,
      orderId
    );
  }
}

export const orderService = new OrderService();

