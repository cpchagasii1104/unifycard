// backend/src/modules/automation/automation.service.ts
// SPRINT 50: AUTOMAÇÕES OPERACIONAIS (CANÔNICAS)

import { alertService } from './alert.service';
import { auditService } from '@core/audit/audit.service';
import type { AutomationEvent, CreateAlertInput } from './automation.types';

/**
 * Service para automações operacionais
 * 
 * ⚠️ REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
 * - NÃO executar economia automaticamente
 * - NÃO tomar decisão irreversível
 * - Automação só alerta, registra ou muda estado simples
 * - Sem IA, sem heurística, sem decisão implícita
 */
class AutomationService {
  /**
   * Processa evento e gera alertas/registros quando necessário
   * 
   * Escuta eventos:
   * - estoque crítico
   * - pagamento falho
   * - fiscal pendente
   * - payout falho
   */
  async processEvent(
    tenantId: string,
    event: AutomationEvent
  ): Promise<void> {
    // 1. Estoque crítico
    if (event.eventType === 'INVENTORY_LOW_STOCK' || event.eventType === 'INVENTORY_OUT_OF_STOCK') {
      await this.handleInventoryAlert(tenantId, event);
    }

    // 2. Pagamento falho
    if (event.eventType === 'PAYMENT_FAILED') {
      await this.handlePaymentFailed(tenantId, event);
    }

    // 3. Payout falho
    if (event.eventType === 'PAYOUT_FAILED') {
      await this.handlePayoutFailed(tenantId, event);
    }

    // 4. Fiscal pendente
    if (event.eventType === 'FISCAL_PENDING') {
      await this.handleFiscalPending(tenantId, event);
    }

    // 5. Pedido expirado
    if (event.eventType === 'ORDER_EXPIRED') {
      await this.handleOrderExpired(tenantId, event);
    }

    // 6. Reserva expirada
    if (event.eventType === 'RESERVATION_EXPIRED') {
      await this.handleReservationExpired(tenantId, event);
    }
  }

  /**
   * Trata alerta de estoque
   */
  private async handleInventoryAlert(
    tenantId: string,
    event: AutomationEvent
  ): Promise<void> {
    const isOutOfStock = event.eventType === 'INVENTORY_OUT_OF_STOCK';
    const severity = isOutOfStock ? 'high' : 'medium';
    const message = isOutOfStock
      ? `Estoque zerado para variante ${event.entityId}`
      : `Estoque baixo para variante ${event.entityId} (${event.context.availableQuantity || 'N/A'} disponível)`;

    await alertService.createAlert(tenantId, {
      type: isOutOfStock ? 'INVENTORY_OUT_OF_STOCK' : 'INVENTORY_LOW_STOCK',
      severity,
      message,
      entityType: 'variant',
      entityId: event.entityId,
      metadata: {
        automation_source: 'inventory_monitor',
        original_event_id: event.context.eventId,
        availableQuantity: event.context.availableQuantity,
        currentQuantity: event.context.currentQuantity,
      },
    });

    // Registrar evento institucional
    await auditService.record(tenantId, {
      event_type: 'AUTOMATION_ALERT_CREATED',
      severity,
      actor_id: undefined,
      actor_type: 'user',
      source: 'automation',
      context: {
        alert_type: isOutOfStock ? 'INVENTORY_OUT_OF_STOCK' : 'INVENTORY_LOW_STOCK',
        entity_type: 'variant',
        entity_id: event.entityId,
      },
    });
  }

  /**
   * Trata pagamento falho
   */
  private async handlePaymentFailed(
    tenantId: string,
    event: AutomationEvent
  ): Promise<void> {
    const message = `Pagamento falhou para pedido ${event.context.orderId || event.entityId}. Erro: ${event.context.errorCode || 'Desconhecido'}`;

    await alertService.createAlert(tenantId, {
      type: 'PAYMENT_FAILED',
      severity: 'high',
      message,
      entityType: 'payment',
      entityId: event.entityId,
      metadata: {
        automation_source: 'payment_monitor',
        original_event_id: event.context.eventId,
        orderId: event.context.orderId,
        errorCode: event.context.errorCode,
        amountCents: event.context.amount,
      },
    });

    // Registrar evento institucional
    await auditService.record(tenantId, {
      event_type: 'AUTOMATION_ALERT_CREATED',
      severity: 'high',
      actor_id: undefined,
      actor_type: 'user',
      source: 'automation',
      context: {
        alert_type: 'PAYMENT_FAILED',
        entity_type: 'payment',
        entity_id: event.entityId,
        order_id: event.context.orderId,
      },
    });
  }

  /**
   * Trata payout falho
   */
  private async handlePayoutFailed(
    tenantId: string,
    event: AutomationEvent
  ): Promise<void> {
    const message = `Payout falhou para split ${event.entityId}. Erro: ${event.context.errorCode || 'Desconhecido'}`;

    await alertService.createAlert(tenantId, {
      type: 'PAYOUT_FAILED',
      severity: 'high',
      message,
      entityType: 'payout',
      entityId: event.entityId,
      metadata: {
        automation_source: 'payout_monitor',
        original_event_id: event.context.eventId,
        paymentIntentId: event.context.paymentIntentId,
        recipientActorId: event.context.recipientActorId,
        errorCode: event.context.errorCode,
        amountCents: event.context.amount,
      },
    });

    // Registrar evento institucional
    await auditService.record(tenantId, {
      event_type: 'AUTOMATION_ALERT_CREATED',
      severity: 'high',
      actor_id: undefined,
      actor_type: 'user',
      source: 'automation',
      context: {
        alert_type: 'PAYOUT_FAILED',
        entity_type: 'payout',
        entity_id: event.entityId,
      },
    });
  }

  /**
   * Trata fiscal pendente
   */
  private async handleFiscalPending(
    tenantId: string,
    event: AutomationEvent
  ): Promise<void> {
    const message = `Documento fiscal pendente para pedido ${event.context.orderId || event.entityId}`;

    await alertService.createAlert(tenantId, {
      type: 'FISCAL_PENDING',
      severity: 'medium',
      message,
      entityType: 'fiscal_document',
      entityId: event.entityId,
      metadata: {
        automation_source: 'fiscal_monitor',
        original_event_id: event.context.eventId,
        orderId: event.context.orderId,
        documentType: event.context.documentType,
      },
    });

    // Registrar evento institucional
    await auditService.record(tenantId, {
      event_type: 'AUTOMATION_ALERT_CREATED',
      severity: 'medium',
      actor_id: undefined,
      actor_type: 'user',
      source: 'automation',
      context: {
        alert_type: 'FISCAL_PENDING',
        entity_type: 'fiscal_document',
        entity_id: event.entityId,
      },
    });
  }

  /**
   * Trata pedido expirado
   */
  private async handleOrderExpired(
    tenantId: string,
    event: AutomationEvent
  ): Promise<void> {
    const message = `Pedido ${event.entityId} expirado`;

    await alertService.createAlert(tenantId, {
      type: 'ORDER_EXPIRED',
      severity: 'low',
      message,
      entityType: 'order',
      entityId: event.entityId,
      metadata: {
        automation_source: 'order_monitor',
        original_event_id: event.context.eventId,
      },
    });

    // Registrar evento institucional
    await auditService.record(tenantId, {
      event_type: 'AUTOMATION_ALERT_CREATED',
      severity: 'low',
      actor_id: undefined,
      actor_type: 'user',
      source: 'automation',
      context: {
        alert_type: 'ORDER_EXPIRED',
        entity_type: 'order',
        entity_id: event.entityId,
      },
    });
  }

  /**
   * Trata reserva expirada
   */
  private async handleReservationExpired(
    tenantId: string,
    event: AutomationEvent
  ): Promise<void> {
    const message = `Reserva de estoque expirada para pedido ${event.context.orderId || event.entityId}`;

    await alertService.createAlert(tenantId, {
      type: 'RESERVATION_EXPIRED',
      severity: 'low',
      message,
      entityType: 'reservation',
      entityId: event.entityId,
      metadata: {
        automation_source: 'reservation_monitor',
        original_event_id: event.context.eventId,
        orderId: event.context.orderId,
      },
    });

    // Registrar evento institucional
    await auditService.record(tenantId, {
      event_type: 'AUTOMATION_ALERT_CREATED',
      severity: 'low',
      actor_id: undefined,
      actor_type: 'user',
      source: 'automation',
      context: {
        alert_type: 'RESERVATION_EXPIRED',
        entity_type: 'reservation',
        entity_id: event.entityId,
      },
    });
  }
}

export const automationService = new AutomationService();








