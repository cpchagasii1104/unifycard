// backend/src/modules/marketplace/payment-method.service.ts
// SPRINT 72: PAYMENT METHODS + UNIFYCARD CORE

import { paymentMethodRepository } from './payment-method.repository';
import type {
  PaymentMethod,
  CreatePaymentMethodInput,
  PaymentMethodFilters,
} from './payment-method.types';

/**
 * Service para Métodos de Pagamento
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Payment Method ≠ Acquirer
 * - Payment Method ≠ Payment Execution
 * - Nenhum dinheiro real
 * - Nenhuma taxa aplicada
 * - Apenas estrutura e preparação
 * - Fee e settlement são declarativos (não executam nada)
 */
class PaymentMethodService {
  /**
   * Cria método de pagamento
   * 
   * Se is_default = true, remove default anterior do actor
   */
  async createMethod(
    tenantId: string,
    input: CreatePaymentMethodInput,
    createdByActorId: string,
    createdByUserId?: string
  ): Promise<PaymentMethod> {
    // Determinar provider baseado no type se não fornecido
    let provider = input.provider;
    if (!provider) {
      if (input.type === 'UNIFYCARD') {
        provider = 'UNIFYCARD';
      } else if (input.type === 'CASH' || input.type === 'PIX') {
        provider = 'INTERNAL';
      } else {
        // CREDIT_CARD, DEBIT_CARD, VOUCHER podem ser INTERNAL ou EXTERNAL
        provider = 'INTERNAL'; // Default
      }
    }

    // Se está marcando como default, remover default anterior
    if (input.isDefault) {
      await paymentMethodRepository.unsetDefaultForActor(tenantId, input.actorId);
    }

    // Criar método
    const method = await paymentMethodRepository.createMethod(tenantId, {
      actorId: input.actorId,
      type: input.type,
      provider,
      feePercentage: input.feePercentage ?? 0,
      settlementDays: input.settlementDays ?? 0,
      isDefault: input.isDefault ?? false,
      createdByActorId,
      createdByUserId: createdByUserId || null,
      metadata: input.metadata || {},
    });

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'PAYMENT_METHOD_CREATED',
      methodId: method.id,
      actorId: method.actorId,
      type: method.type,
      provider: method.provider,
      createdByActorId,
      createdByUserId,
    });

    return method;
  }

  /**
   * Lista métodos com filtros
   */
  async listMethods(tenantId: string, filters: PaymentMethodFilters = {}): Promise<PaymentMethod[]> {
    return await paymentMethodRepository.listMethods(tenantId, filters);
  }

  /**
   * Busca método por ID
   */
  async getMethodById(tenantId: string, methodId: string): Promise<PaymentMethod | null> {
    return await paymentMethodRepository.getMethodById(tenantId, methodId);
  }

  /**
   * Busca método default do actor
   */
  async getDefaultMethod(tenantId: string, actorId: string): Promise<PaymentMethod | null> {
    return await paymentMethodRepository.getDefaultMethod(tenantId, actorId);
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
      methodId: string;
      actorId: string;
      type: string;
      provider: string;
      createdByActorId: string;
      createdByUserId?: string | null;
    }
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: data.eventType,
        severity: 'low',
        actor_id: data.createdByActorId,
        actor_type: 'user',
        source: 'validation',
        context: {
          method_id: data.methodId,
          actor_id: data.actorId,
          type: data.type,
          provider: data.provider,
          created_by_user_id: data.createdByUserId,
        },
      });
    } catch (error) {
      // Não bloquear se auditoria falhar
      console.warn('[PaymentMethod] Erro ao registrar auditoria:', error);
    }
  }
}

export const paymentMethodService = new PaymentMethodService();






