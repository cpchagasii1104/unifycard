// backend/src/modules/marketplace/purchase-order.service.ts
// SPRINT 69: SUPPLIERS + PURCHASE ORDERS

import { purchaseOrderRepository } from './purchase-order.repository';
import { inventoryService } from './inventory.service';
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  CreatePurchaseOrderInput,
  AddPurchaseOrderItemInput,
  ReceivePurchaseOrderInput,
  PurchaseOrderFilters,
} from './purchase-order.types';

/**
 * Service para Ordens de Compra
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Append-only: status muda, mas registros não desaparecem
 * - Status declarativos
 * - Audit em todas as mudanças
 * - Purchase Order NÃO é Order (marketplace)
 * - NÃO executa pagamentos
 * - NÃO emite fiscal
 * - Inventory entra apenas no RECEIVE
 */
class PurchaseOrderService {
  /**
   * Cria ordem de compra (status: DRAFT)
   */
  async createPO(
    tenantId: string,
    input: CreatePurchaseOrderInput,
    createdByActorId: string,
    createdByUserId?: string
  ): Promise<PurchaseOrder> {
    // Converter datas se necessário
    const orderDate = input.orderDate ? (input.orderDate instanceof Date ? input.orderDate : new Date(input.orderDate)) : new Date();
    const expectedDeliveryDate = input.expectedDeliveryDate ? (input.expectedDeliveryDate instanceof Date ? input.expectedDeliveryDate : new Date(input.expectedDeliveryDate)) : null;

    // Criar ordem
    const order = await purchaseOrderRepository.createPurchaseOrder(tenantId, {
      supplierId: input.supplierId,
      orderNumber: input.orderNumber || null,
      orderDate,
      expectedDeliveryDate,
      deliveryAddress: input.deliveryAddress || null,
      deliveryCity: input.deliveryCity || null,
      deliveryState: input.deliveryState || null,
      deliveryZipCode: input.deliveryZipCode || null,
      notes: input.notes || null,
      internalNotes: input.internalNotes || null,
      createdByActorId,
      createdByUserId: createdByUserId || null,
      metadata: input.metadata || {},
    });

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'PURCHASE_ORDER_CREATED',
      orderId: order.id,
      status: order.status,
      createdByActorId,
      createdByUserId,
    });

    return order;
  }

  /**
   * Adiciona item à ordem
   */
  async addItem(
    tenantId: string,
    orderId: string,
    input: AddPurchaseOrderItemInput,
    createdByActorId: string,
    createdByUserId?: string
  ): Promise<PurchaseOrderItem> {
    // Validar ordem existe e está em DRAFT
    const order = await purchaseOrderRepository.getPurchaseOrderById(tenantId, orderId);
    if (!order) {
      throw new Error(`Ordem não encontrada: ${orderId}`);
    }

    if (order.status !== 'DRAFT') {
      throw new Error(`Ordem não está em DRAFT (status: ${order.status})`);
    }

    // Calcular total se unitPriceCents fornecido
    const totalPriceCents = input.unitPriceCents ? Math.round(input.unitPriceCents * input.quantityOrdered) : null;

    // Adicionar item
    const item = await purchaseOrderRepository.addItem(tenantId, orderId, {
      productVariantId: input.productVariantId,
      quantityOrdered: input.quantityOrdered,
      unit: input.unit || 'un',
      unitPriceCents: input.unitPriceCents || null,
      currency: input.currency || 'BRL',
      totalPriceCents,
      notes: input.notes || null,
      createdByActorId,
      createdByUserId: createdByUserId || null,
      metadata: input.metadata || {},
    });

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'PURCHASE_ORDER_ITEM_ADDED',
      orderId,
      itemId: item.id,
      createdByActorId,
      createdByUserId,
    });

    return item;
  }

  /**
   * Submete ordem ao fornecedor (DRAFT → SUBMITTED)
   */
  async submitPO(
    tenantId: string,
    orderId: string,
    submittedByActorId: string,
    submittedByUserId?: string
  ): Promise<PurchaseOrder> {
    // Validar ordem existe e está em DRAFT
    const order = await purchaseOrderRepository.getPurchaseOrderById(tenantId, orderId);
    if (!order) {
      throw new Error(`Ordem não encontrada: ${orderId}`);
    }

    if (order.status !== 'DRAFT') {
      throw new Error(`Ordem não está em DRAFT (status: ${order.status})`);
    }

    // Validar que ordem tem itens
    const items = await purchaseOrderRepository.getItemsByOrderId(tenantId, orderId);
    if (items.length === 0) {
      throw new Error('Ordem não pode ser submetida sem itens');
    }

    // Submeter ordem
    const submittedOrder = await purchaseOrderRepository.submitOrder(tenantId, orderId, submittedByActorId);

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'PURCHASE_ORDER_SUBMITTED',
      orderId: submittedOrder.id,
      status: submittedOrder.status,
      submittedByActorId,
      submittedByUserId,
    });

    return submittedOrder;
  }

  /**
   * Recebe ordem (SUBMITTED/RECEIVED → RECEIVED/COMPLETED)
   * 
   * SPRINT 69: Gera inventory_movements IN para cada item recebido
   */
  async receivePO(
    tenantId: string,
    orderId: string,
    input: ReceivePurchaseOrderInput,
    receivedByUserId?: string
  ): Promise<{ order: PurchaseOrder; movements: Array<{ itemId: string; movementId: string }> }> {
    // Validar ordem existe e está em SUBMITTED ou RECEIVED
    const order = await purchaseOrderRepository.getPurchaseOrderById(tenantId, orderId);
    if (!order) {
      throw new Error(`Ordem não encontrada: ${orderId}`);
    }

    if (!['SUBMITTED', 'RECEIVED'].includes(order.status)) {
      throw new Error(`Ordem não pode ser recebida (status: ${order.status})`);
    }

    // Buscar itens da ordem
    const items = await purchaseOrderRepository.getItemsByOrderId(tenantId, orderId);

    // Processar recebimento de cada item
    const movements: Array<{ itemId: string; movementId: string }> = [];

    for (const receiveItem of input.items) {
      const item = items.find((i) => i.id === receiveItem.itemId);
      if (!item) {
        throw new Error(`Item não encontrado: ${receiveItem.itemId}`);
      }

      // Validar quantidade recebida não excede quantidade solicitada
      const newQuantityReceived = item.quantityReceived + receiveItem.quantityReceived;
      if (newQuantityReceived > item.quantityOrdered) {
        throw new Error(
          `Quantidade recebida excede quantidade solicitada. Item: ${item.id}, Solicitado: ${item.quantityOrdered}, Recebido: ${newQuantityReceived}`
        );
      }

      // Atualizar quantidade recebida
      await purchaseOrderRepository.updateItemQuantityReceived(
        tenantId,
        item.id,
        newQuantityReceived
      );

      // SPRINT 69: Criar inventory_movement IN
      if (receiveItem.quantityReceived > 0) {
        const movement = await inventoryService.addMovement(tenantId, {
          productVariantId: item.productVariantId,
          movementType: 'IN',
          quantity: receiveItem.quantityReceived,
          unit: item.unit,
          reason: `Recebimento de ordem de compra ${order.orderNumber || orderId}`,
          referenceType: 'purchase_order',
          referenceId: orderId,
          metadata: {
            purchase_order_id: orderId,
            purchase_order_item_id: item.id,
            supplier_id: order.supplierId,
            notes: receiveItem.notes || input.notes,
          },
        }, receivedByUserId);

        movements.push({
          itemId: item.id,
          movementId: movement.id,
        });
      }
    }

    // Atualizar status da ordem
    // Se todos os itens foram recebidos completamente, marcar como COMPLETED
    const updatedItems = await purchaseOrderRepository.getItemsByOrderId(tenantId, orderId);
    const allItemsReceived = updatedItems.every((item) => item.quantityReceived >= item.quantityOrdered);

    let updatedOrder: PurchaseOrder;
    if (allItemsReceived) {
      // Marcar como RECEIVED primeiro (se ainda não estiver)
      if (order.status !== 'RECEIVED') {
        updatedOrder = await purchaseOrderRepository.markAsReceived(tenantId, orderId);
      } else {
        updatedOrder = order;
      }
      // Marcar como COMPLETED
      updatedOrder = await purchaseOrderRepository.markAsCompleted(tenantId, orderId);
    } else {
      // Marcar como RECEIVED (parcial)
      updatedOrder = await purchaseOrderRepository.markAsReceived(tenantId, orderId);
    }

    // SPRINT 70: Criar conta a pagar quando ordem é recebida
    // Calcular total da ordem (soma dos itens recebidos)
    let totalAmountCents = 0;
    for (const receiveItem of input.items) {
      const item = items.find((i) => i.id === receiveItem.itemId);
      if (item) {
        // Calcular valor proporcional recebido
        if (item.unitPriceCents) {
          // Se tem preço unitário, calcular: unitPrice * quantityReceived
          totalAmountCents += Math.round(item.unitPriceCents * receiveItem.quantityReceived);
        } else if (item.totalPriceCents) {
          // Se tem total, calcular proporção
          const proportion = receiveItem.quantityReceived / item.quantityOrdered;
          totalAmountCents += Math.round(item.totalPriceCents * proportion);
        }
        // Se não tem preço, não adiciona ao total (pode ser item sem valor)
      }
    }

    // Se houver valor a pagar, criar conta
    if (totalAmountCents > 0) {
      try {
        const { accountsPayableService } = await import('./accounts-payable.service');
        // Calcular data de vencimento (30 dias após recebimento, ou usar expected_delivery_date se fornecido)
        const dueDate = order.expectedDeliveryDate
          ? new Date(order.expectedDeliveryDate.getTime() + 30 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        await accountsPayableService.createFromPurchaseOrder(
          tenantId,
          {
            purchaseOrderId: orderId,
            amountCents: totalAmountCents,
            currency: 'BRL',
            dueDate,
            metadata: {
              purchase_order_number: order.orderNumber,
              items_received: input.items.length,
            },
          },
          order.createdByActorId,
          receivedByUserId || order.createdByUserId || undefined
        );
      } catch (payableError) {
        // Não bloquear recebimento se criação de payable falhar
        console.warn(`[PurchaseOrder] Erro ao criar conta a pagar para ordem ${orderId}:`, payableError);
      }
    }

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'PURCHASE_ORDER_RECEIVED',
      orderId: updatedOrder.id,
      status: updatedOrder.status,
      receivedByUserId,
      itemsReceived: input.items.length,
    });

    return { order: updatedOrder, movements };
  }

  /**
   * Cancela ordem
   */
  async cancelPO(
    tenantId: string,
    orderId: string,
    cancelledByActorId: string,
    cancelledByUserId?: string,
    cancellationReason?: string
  ): Promise<PurchaseOrder> {
    // Validar ordem existe e pode ser cancelada
    const order = await purchaseOrderRepository.getPurchaseOrderById(tenantId, orderId);
    if (!order) {
      throw new Error(`Ordem não encontrada: ${orderId}`);
    }

    if (!['DRAFT', 'SUBMITTED'].includes(order.status)) {
      throw new Error(`Ordem não pode ser cancelada (status: ${order.status})`);
    }

    // Cancelar ordem
    const cancelledOrder = await purchaseOrderRepository.cancelOrder(
      tenantId,
      orderId,
      cancelledByActorId,
      cancellationReason || null
    );

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'PURCHASE_ORDER_CANCELLED',
      orderId: cancelledOrder.id,
      status: cancelledOrder.status,
      cancelledByActorId,
      cancelledByUserId,
      cancellationReason,
    });

    return cancelledOrder;
  }

  /**
   * Lista ordens com filtros
   */
  async listPOs(tenantId: string, filters: PurchaseOrderFilters = {}): Promise<PurchaseOrder[]> {
    return await purchaseOrderRepository.listPurchaseOrders(tenantId, filters);
  }

  /**
   * Busca ordem por ID
   */
  async getPOById(tenantId: string, orderId: string): Promise<PurchaseOrder | null> {
    return await purchaseOrderRepository.getPurchaseOrderById(tenantId, orderId);
  }

  /**
   * Busca itens de uma ordem
   */
  async getItemsByOrderId(tenantId: string, orderId: string): Promise<PurchaseOrderItem[]> {
    return await purchaseOrderRepository.getItemsByOrderId(tenantId, orderId);
  }

  // ============================================================
  // MÉTODOS PRIVADOS
  // ============================================================

  /**
   * Registra evento de auditoria
   */
  private async recordAudit(
    tenantId: string,
    data: {
      eventType: string;
      orderId: string;
      status?: string;
      itemId?: string;
      createdByActorId?: string;
      createdByUserId?: string | null;
      submittedByActorId?: string;
      submittedByUserId?: string | null;
      receivedByUserId?: string | null;
      itemsReceived?: number;
      cancelledByActorId?: string;
      cancelledByUserId?: string | null;
      cancellationReason?: string | null;
    }
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: data.eventType,
        severity: 'MEDIUM',
        actor_id: data.createdByActorId || data.submittedByActorId || data.cancelledByActorId || null,
        actor_type: 'user',
        source: 'automation',
        context: {
          order_id: data.orderId,
          status: data.status,
          item_id: data.itemId,
          created_by_user_id: data.createdByUserId,
          submitted_by_actor_id: data.submittedByActorId,
          submitted_by_user_id: data.submittedByUserId,
          received_by_user_id: data.receivedByUserId,
          items_received: data.itemsReceived,
          cancelled_by_actor_id: data.cancelledByActorId,
          cancelled_by_user_id: data.cancelledByUserId,
          cancellation_reason: data.cancellationReason,
        },
      });
    } catch (error) {
      // Não bloquear se auditoria falhar
      console.warn('[PurchaseOrder] Erro ao registrar auditoria:', error);
    }
  }
}

export const purchaseOrderService = new PurchaseOrderService();

