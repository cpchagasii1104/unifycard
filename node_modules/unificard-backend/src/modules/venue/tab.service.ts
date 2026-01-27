// backend/src/modules/venue/tab.service.ts
// SPRINT 92: MENU + COMANDA (TAB) + QR ORDERING

import { tabRepository } from './tab.repository';
import type {
  Tab,
  OpenTabInput,
  TabFilters,
  TabWithOrders,
} from './tab.types';

/**
 * Service para Comandas (Tabs)
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Tab NÃO é pagamento
 * - Tab apenas organiza pedidos
 * - Pedidos são Orders normais do marketplace
 * - QR token é apenas ponte para buscar status
 */
class TabService {
  async openTab(
    tenantId: string,
    input: OpenTabInput,
    contactId?: string,
    userId?: string
  ): Promise<Tab> {
    const tab = await tabRepository.createTab(tenantId, input, contactId, userId);

    await this.recordAudit(tenantId, {
      eventType: 'TAB_OPENED',
      tabId: tab.id,
      actorId: input.actorId,
      tableLabel: input.tableLabel,
      contactId,
      qrToken: tab.qrToken,
    });

    return tab;
  }

  async getTabByToken(tenantId: string, qrToken: string): Promise<Tab | null> {
    return await tabRepository.getTabByToken(tenantId, qrToken);
  }

  async getTabWithOrders(tenantId: string, tabId: string): Promise<TabWithOrders> {
    const tab = await tabRepository.getTabById(tenantId, tabId);
    if (!tab) {
      throw new Error(`Comanda não encontrada: ${tabId}`);
    }

    const orders = await tabRepository.getTabOrders(tenantId, tabId);

    return {
      ...tab,
      orders,
    };
  }

  async attachOrderToTab(tenantId: string, tabId: string, orderId: string): Promise<void> {
    // Validar tab existe e está OPEN
    const tab = await tabRepository.getTabById(tenantId, tabId);
    if (!tab) {
      throw new Error(`Comanda não encontrada: ${tabId}`);
    }

    if (tab.status !== 'OPEN') {
      throw new Error(`Comanda não está aberta (status: ${tab.status})`);
    }

    await tabRepository.attachOrderToTab(tenantId, tabId, orderId);

    await this.recordAudit(tenantId, {
      eventType: 'TAB_ORDER_ATTACHED',
      tabId,
      orderId,
    });
  }

  async closeTab(tenantId: string, tabId: string): Promise<Tab> {
    const tab = await tabRepository.getTabById(tenantId, tabId);
    if (!tab) {
      throw new Error(`Comanda não encontrada: ${tabId}`);
    }

    if (tab.status !== 'OPEN') {
      throw new Error(`Comanda não está aberta (status: ${tab.status})`);
    }

    // Buscar orders vinculados para calcular resumo
    const orders = await tabRepository.getTabOrders(tenantId, tabId);
    
    // Buscar orders para calcular totais
    const { orderRepository } = await import('../marketplace/order.repository');
    let totalAmount = 0;
    for (const tabOrder of orders) {
      const order = await orderRepository.getOrderById(tenantId, tabOrder.orderId);
      if (order) {
        // Calcular total do order (futuro: usar método do OrderService)
        // Por enquanto, apenas contar orders
      }
    }

    const summary = {
      ordersCount: orders.length,
      closedAt: new Date().toISOString(),
    };

    const closedTab = await tabRepository.closeTab(tenantId, tabId, summary);

    await this.recordAudit(tenantId, {
      eventType: 'TAB_CLOSED',
      tabId,
      summary,
    });

    return closedTab;
  }

  async listTabs(tenantId: string, filters: TabFilters = {}): Promise<Tab[]> {
    return await tabRepository.listTabs(tenantId, filters);
  }

  /**
   * Cria order vinculado a tab
   */
  async createOrderForTab(
    tenantId: string,
    tabId: string,
    source: 'VENUE_QR' = 'VENUE_QR'
  ): Promise<{ orderId: string; tabId: string }> {
    const tab = await tabRepository.getTabById(tenantId, tabId);
    if (!tab) {
      throw new Error(`Comanda não encontrada: ${tabId}`);
    }

    if (tab.status !== 'OPEN') {
      throw new Error(`Comanda não está aberta (status: ${tab.status})`);
    }

    // Criar order DRAFT
    const { orderService } = await import('../marketplace/order.service');
    
    // Assumir que buyer é o contact (se houver) ou criar order sem buyer específico
    // Por enquanto, usar actor_id como buyer e seller (estabelecimento)
    const order = await orderService.createOrder(tenantId, {
      buyerActorId: tab.openedByContactId ? tab.actorId : tab.actorId, // Futuro: resolver buyer correto
      sellerActorId: tab.actorId,
      status: 'DRAFT',
      metadata: {
        tab_id: tabId,
        source: 'VENUE',
        channel: 'ON_PREMISE',
        qr_token: tab.qrToken,
        contact_id: tab.openedByContactId,
      },
    });

    // Vincular order à tab
    await this.attachOrderToTab(tenantId, tabId, order.id);

    await this.recordAudit(tenantId, {
      eventType: 'TAB_ORDER_CREATED',
      tabId,
      orderId: order.id,
    });

    return { orderId: order.id, tabId };
  }

  private async recordAudit(tenantId: string, data: Record<string, any>): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, data);
    } catch (error) {
      console.warn('[TabService] Erro ao registrar auditoria:', error);
    }
  }
}

export const tabService = new TabService();





