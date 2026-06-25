// backend/src/modules/marketplace/purchase-order.service.ts
// SPRINT 69: SUPPLIERS + PURCHASE ORDERS

import { purchaseOrderRepository } from './purchase-order.repository';
import { inventoryService } from './inventory.service';
import { AppError } from '@core/errors';
import { isActorEffectivelyBlocked } from '@modules/risk-identity/actor-effective-block';
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
   * 🔴 F-PURCHASE-ORDER-SUPPLIER-QUARANTINE-GATE (§4.8.4) — autoridade-ATIVA. canRepresentActor (na rota) DECIDE
   * permissão sobre o owner empresarial; quarentena DECIDE se o actor está ATIVO. PO declarativa é money-free
   * (receivePO/inventory/AP seguem CONTIDOS, fora desta fatia). Recebe actorId JÁ RESOLVIDO (owner_actor_id
   * autoridade OU acting/createdBy/submittedBy/cancelledBy autoria), NUNCA userId cru/referral/created_by-como-autoridade.
   * Chamar ANTES de qualquer escrita declarativa (purchase_orders / purchase_order_items). NÃO toca canRepresentActor.
   */
  private async assertActorNotQuarantined(tenantId: string, actorId: string): Promise<void> {
    if (await isActorEffectivelyBlocked(tenantId, actorId)) {
      throw new AppError(403, 'ACTOR_EFFECTIVELY_BLOCKED: actor em quarentena (ou âncora humana bloqueada) — mutação de purchase order bloqueada (§4.8.4).', 'ACTOR_EFFECTIVELY_BLOCKED');
    }
  }

  /**
   * Cria ordem de compra (status: DRAFT)
   */
  async createPO(
    tenantId: string,
    input: CreatePurchaseOrderInput,
    createdByActorId: string,
    createdByUserId?: string
  ): Promise<PurchaseOrder> {
    // 🔒 F-C1-MONEY-PO-OWNER: owner empresarial é OBRIGATÓRIO e validado server-side pela rota (page+company_id
    // representável). Defesa em profundidade: o service NUNCA persiste PO sem owner empresarial material.
    if (!input.ownerActorId) {
      throw new AppError(400, 'PURCHASE_ORDER_OWNER_REQUIRED: purchase_order exige owner empresarial material (owner_actor_id) resolvido e validado server-side.', 'PURCHASE_ORDER_OWNER_REQUIRED');
    }

    // 🔴 F-PURCHASE-ORDER-SUPPLIER-QUARANTINE-GATE: owner empresarial bloqueado → não cria PO em seu nome; e o
    // acting/createdBy bloqueado → não opera. ANTES da escrita. (created_by é AUTORIA, não autoridade.)
    await this.assertActorNotQuarantined(tenantId, input.ownerActorId);
    if (createdByActorId && createdByActorId !== input.ownerActorId) {
      await this.assertActorNotQuarantined(tenantId, createdByActorId);
    }

    // Converter datas se necessário
    const orderDate = input.orderDate ? (input.orderDate instanceof Date ? input.orderDate : new Date(input.orderDate)) : new Date();
    const expectedDeliveryDate = input.expectedDeliveryDate ? (input.expectedDeliveryDate instanceof Date ? input.expectedDeliveryDate : new Date(input.expectedDeliveryDate)) : null;

    // Criar ordem
    const order = await purchaseOrderRepository.createPurchaseOrder(tenantId, {
      supplierId: input.supplierId,
      ownerActorId: input.ownerActorId,
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

    // 🔴 F-PURCHASE-ORDER-SUPPLIER-QUARANTINE-GATE: owner empresarial da PO (order.ownerActorId, autoridade) ou
    // o acting/createdBy bloqueado → 403 ANTES de gravar item.
    await this.assertActorNotQuarantined(tenantId, order.ownerActorId);
    if (createdByActorId && createdByActorId !== order.ownerActorId) {
      await this.assertActorNotQuarantined(tenantId, createdByActorId);
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

    // 🔴 F-PURCHASE-ORDER-SUPPLIER-QUARANTINE-GATE: owner empresarial ou o acting/submittedBy bloqueado → 403 ANTES de submeter.
    await this.assertActorNotQuarantined(tenantId, order.ownerActorId);
    if (submittedByActorId && submittedByActorId !== order.ownerActorId) {
      await this.assertActorNotQuarantined(tenantId, submittedByActorId);
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
    // 🔒 F-C1-MONEY-PO-RECEIVE-EXPLICIT-CONTAINMENT (decisão Clayton: purchase_order NÃO é creator-owned).
    // HARD-STOP fail-closed ANTES de QUALQUER mutação. O efeito material de recebimento — inventory IN
    // (hoje usando order.createdByActorId como actor), status RECEIVED/COMPLETED e accounts payable — NÃO
    // pode rodar enquanto a purchase_order não tiver OWNER EMPRESARIAL MATERIAL (company-owned /
    // company_actor_owned; frente futura de schema/modelagem/backfill). Owner material provado hoje = só
    // tenant_id (sem company_id/company_actor_id/owner_actor_id/received_by_actor_id no schema vivo).
    // `created_by_actor_id` é AUTORIA histórica, NUNCA autoridade. Esta contenção é EXPLÍCITA (não acidental)
    // e independe de actionContext.actingUserId/actorId e de created_by_actor_id. NÃO remover sem owner material.
    throw new AppError(
      403,
      'PURCHASE_ORDER_RECEIVE_CONTAINED: receivePO está bloqueado até purchase_order ter owner empresarial material (company-owned). created_by_actor_id é autoria, não autoridade. Ref: F-C1-MONEY-PO-RECEIVE-EXPLICIT-CONTAINMENT.',
      'PURCHASE_ORDER_RECEIVE_CONTAINED'
    );
  }

  /**
   * 🔒 CONTIDO — implementação material de recebimento PRESERVADA mas NÃO CHAMADA.
   * Toda a mutação (updateItemQuantityReceived / inventoryService.addMovement IN /
   * markAsReceived / markAsCompleted / accountsPayableService.createFromPurchaseOrder) vive AQUI,
   * fisicamente separada de receivePO (que é hard-stop fail-closed). NENHUM caller a invoca.
   * Reabilitação SÓ quando purchase_order tiver OWNER EMPRESARIAL MATERIAL (company-owned) — e mesmo
   * então a autoridade deverá vir do owner empresarial, NUNCA de order.createdByActorId (autoria).
   */
  private async receivePOContainedImpl(
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

    if (!['SUBMITTED', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED'].includes(order.status)) {
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
          actorId: order.createdByActorId,
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

    if (!['DRAFT', 'SUBMITTED', 'CONFIRMED'].includes(order.status)) {
      throw new Error(`Ordem não pode ser cancelada (status: ${order.status})`);
    }

    // 🔴 F-PURCHASE-ORDER-SUPPLIER-QUARANTINE-GATE: owner empresarial ou o acting/cancelledBy bloqueado → 403 ANTES de cancelar.
    await this.assertActorNotQuarantined(tenantId, order.ownerActorId);
    if (cancelledByActorId && cancelledByActorId !== order.ownerActorId) {
      await this.assertActorNotQuarantined(tenantId, cancelledByActorId);
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
        severity: 'medium',
        actor_id: (data.createdByActorId || data.submittedByActorId || data.cancelledByActorId) ?? undefined,
        actor_type: 'user',
        source: 'automation',
        context: {
          order_id: data.orderId,
          status: data.status,
          item_id: data.itemId,
          created_by_user_id: data.createdByUserId ?? undefined,
          submitted_by_actor_id: data.submittedByActorId,
          submitted_by_user_id: data.submittedByUserId ?? undefined,
          received_by_user_id: data.receivedByUserId ?? undefined,
          items_received: data.itemsReceived,
          cancelled_by_actor_id: data.cancelledByActorId,
          cancelled_by_user_id: data.cancelledByUserId ?? undefined,
          cancellation_reason: data.cancellationReason ?? undefined,
        },
      });
    } catch (error) {
      // Não bloquear se auditoria falhar
      console.warn('[PurchaseOrder] Erro ao registrar auditoria:', error);
    }
  }
}

export const purchaseOrderService = new PurchaseOrderService();

