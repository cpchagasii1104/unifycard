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
    if (event.eventType === 'inventory_low_stock' || event.eventType === 'inventory_out_of_stock') {
      await this.handleInventoryAlert(tenantId, event);
    }

    // 2. Pagamento falho
    if (event.eventType === 'payment_failed') {
      await this.handlePaymentFailed(tenantId, event);
    }

    // 3. Payout falho
    if (event.eventType === 'payout_failed') {
      await this.handlePayoutFailed(tenantId, event);
    }

    // 4. Fiscal pendente
    if (event.eventType === 'fiscal_pending') {
      await this.handleFiscalPending(tenantId, event);
    }

    // 5. Pedido expirado
    if (event.eventType === 'order_expired') {
      await this.handleOrderExpired(tenantId, event);
    }

    // 6. Reserva expirada
    if (event.eventType === 'reservation_expired') {
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
    const isOutOfStock = event.eventType === 'inventory_out_of_stock';
    const severity = isOutOfStock ? 'ERROR' : 'WARNING';
    const message = isOutOfStock
      ? `Estoque zerado para variante ${event.entityId}`
      : `Estoque baixo para variante ${event.entityId} (${event.context.availableQuantity || 'N/A'} disponível)`;

    await alertService.createAlert(tenantId, {
      type: isOutOfStock ? 'inventory_out_of_stock' : 'inventory_low_stock',
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
        alert_type: isOutOfStock ? 'inventory_out_of_stock' : 'inventory_low_stock',
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
      type: 'payment_failed',
      severity: 'ERROR',
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
      severity: 'ERROR',
      actor_id: undefined,
      actor_type: 'user',
      source: 'automation',
      context: {
        alert_type: 'payment_failed',
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
      type: 'payout_failed',
      severity: 'ERROR',
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
      severity: 'ERROR',
      actor_id: undefined,
      actor_type: 'user',
      source: 'automation',
      context: {
        alert_type: 'payout_failed',
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
      type: 'fiscal_pending',
      severity: 'WARNING',
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
      severity: 'WARNING',
      actor_id: undefined,
      actor_type: 'user',
      source: 'automation',
      context: {
        alert_type: 'fiscal_pending',
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
      type: 'order_expired',
      severity: 'INFO',
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
      severity: 'INFO',
      actor_id: undefined,
      actor_type: 'user',
      source: 'automation',
      context: {
        alert_type: 'order_expired',
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
      type: 'reservation_expired',
      severity: 'INFO',
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
      severity: 'INFO',
      actor_id: undefined,
      actor_type: 'user',
      source: 'automation',
      context: {
        alert_type: 'reservation_expired',
        entity_type: 'reservation',
        entity_id: event.entityId,
      },
    });
  }
}

export const automationService = new AutomationService();








