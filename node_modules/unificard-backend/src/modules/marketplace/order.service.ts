// backend/src/modules/marketplace/order.service.ts
// SPRINT 38.1: MARKETPLACE EXECUÇÃO - Order Core
// SPRINT 38.2: MARKETPLACE EXECUÇÃO - Order Lifecycle
// Service para pedidos

import { orderRepository } from './order.repository';
import { orderItemRepository } from './order-item.repository';
import { orderStatusHistoryRepository } from './order-status-history.repository';
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
    DRAFT: ['SUBMITTED', 'CANCELLED'],
    SUBMITTED: ['CANCELLED', 'EXPIRED'],
    CANCELLED: [], // Nunca volta
    EXPIRED: [], // Nunca volta
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

    if (order.status !== 'DRAFT') {
      throw new Error(
        `Não é possível adicionar item. Pedido está em status ${order.status}. Apenas DRAFT permite edição.`
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

    // SPRINT 43: Reservar estoque antes de adicionar item
    const { inventoryReservationService } = await import('./inventory-reservation.service');
    try {
      await inventoryReservationService.reserveStock(tenantId, {
        productVariantId: input.productVariantId,
        quantity: input.quantity,
        orderId,
        source: source as any,
      });
    } catch (reservationError: any) {
      // Se erro de estoque insuficiente, propagar erro claro
      if (reservationError.message.includes('insuficiente') || reservationError.message.includes('insufficient')) {
        throw reservationError;
      }
      // Outros erros também propagam
      throw reservationError;
    }

    // Validação leve de unidade (opcional, não bloqueia)
    // Por enquanto, apenas aceita qualquer unidade

    // SPRINT 48: Resolver preço ANTES de criar item (snapshot)
    let priceSnapshot: any = null;
    try {
      const { pricingService } = await import('./pricing.service');
      const product = await productRepository.getProductById(tenantId, variant.productId);
      if (product) {
        const priceBreakdown = await pricingService.getCurrentPrice(tenantId, {
          variantId: input.productVariantId,
          productId: product.id,
          categoryId: product.categoryId || undefined,
          quantity: input.quantity,
        });
        priceSnapshot = {
          basePrice: priceBreakdown.basePrice,
          discountAmount: priceBreakdown.discountAmount,
          finalPrice: priceBreakdown.finalPrice,
          currency: priceBreakdown.currency,
          promotions: priceBreakdown.promotions,
          resolvedAt: new Date().toISOString(),
        };
      }
    } catch (priceError) {
      // Log mas não bloqueia criação do item
      console.warn(`[OrderService] Erro ao resolver preço para variante ${input.productVariantId}:`, priceError);
    }

    // Criar item com snapshot de preço no metadata
    const itemInput = {
      ...input,
      metadata: {
        ...input.metadata,
        priceSnapshot, // SPRINT 48: Snapshot do preço resolvido
      },
    };

    const item = await orderItemRepository.createItem(
      tenantId,
      orderId,
      itemInput
    );

    // Atualizar total_quantity do pedido
    const totalQuantity = await orderItemRepository.calculateTotalQuantity(
      tenantId,
      orderId
    );
    await orderRepository.updateTotalQuantity(tenantId, orderId, totalQuantity);

    return item;
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

    if (order.status !== 'DRAFT') {
      throw new Error(
        `Não é possível remover item. Pedido está em status ${order.status}. Apenas DRAFT permite edição.`
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
      toStatus: 'SUBMITTED',
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
    // SPRINT 43: Liberar reservas antes de cancelar
    const { inventoryReservationService } = await import('./inventory-reservation.service');
    try {
      await inventoryReservationService.releaseReservation(tenantId, orderId);
    } catch (releaseError) {
      // Log mas não bloqueia cancelamento
      console.warn(`[OrderService] Erro ao liberar reservas ao cancelar pedido ${orderId}:`, releaseError);
    }

    // Mudar status (valida transição e registra histórico)
    return await this.changeOrderStatus(tenantId, orderId, {
      toStatus: 'CANCELLED',
      changedByUserId,
      reason: reason || 'Pedido cancelado',
    });
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
      toStatus: 'EXPIRED',
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

