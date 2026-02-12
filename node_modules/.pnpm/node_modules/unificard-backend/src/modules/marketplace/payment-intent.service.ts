// backend/src/modules/marketplace/payment-intent.service.ts
// SPRINT 39.1: MARKETPLACE EXECUÇÃO - Payment Intent
// Service para intenções de pagamento

import { paymentIntentRepository } from './payment-intent.repository';
import { orderRepository } from './order.repository';
import type {
  PaymentIntent,
  CreatePaymentIntentInput,
  UpdatePaymentIntentInput,
} from './payment-intent.types';

/**
 * Service para payment intents
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - PaymentIntent não executa transação bancária
 * - Estados são declarativos
 * - Authorization apenas muda status
 * - Cancel não executa rollback
 * - Nenhuma integração com Bank ainda
 */
class PaymentIntentService {
  /**
   * Cria payment intent
   * 
   * Regras:
   * - Só criar intent para order SUBMITTED
   * - Um order pode ter múltiplos intents (tentativas)
   */
  async createPaymentIntent(
    tenantId: string,
    input: CreatePaymentIntentInput
  ): Promise<PaymentIntent> {
    // Verificar se pedido existe e está em SUBMITTED
    const order = await orderRepository.getOrderById(tenantId, input.orderId);

    if (!order) {
      throw new Error(`Pedido não encontrado: ${input.orderId}`);
    }

    if (order.status !== 'SUBMITTED') {
      throw new Error(
        `Payment intent só pode ser criado para pedidos SUBMITTED. Status atual: ${order.status}`
      );
    }

    // Validar amount
    if (input.amount <= 0) {
      throw new Error('Amount deve ser maior que zero');
    }

    // SPRINT 72: Se paymentMethodId fornecido, buscar método e fazer snapshot no metadata
    let metadata = input.metadata || {};
    if (input.paymentMethodId) {
      const { paymentMethodService } = await import('./payment-method.service');
      const paymentMethod = await paymentMethodService.getMethodById(tenantId, input.paymentMethodId);
      
      if (!paymentMethod) {
        throw new Error(`Método de pagamento não encontrado: ${input.paymentMethodId}`);
      }

      // Fazer snapshot do método no metadata
      metadata = {
        ...metadata,
        payment_method_snapshot: {
          id: paymentMethod.id,
          type: paymentMethod.type,
          provider: paymentMethod.provider,
          fee_percentage: paymentMethod.feePercentage,
          settlement_days: paymentMethod.settlementDays,
        },
        payment_method_id: paymentMethod.id,
      };
    }

    return await paymentIntentRepository.createIntent(tenantId, {
      ...input,
      metadata,
    });
  }

  /**
   * Busca payment intent por ID
   */
  async getIntentById(
    tenantId: string,
    intentId: string
  ): Promise<PaymentIntent | null> {
    return await paymentIntentRepository.getIntentById(tenantId, intentId);
  }

  /**
   * Lista payment intents de um pedido
   */
  async listPaymentIntentsByOrder(
    tenantId: string,
    orderId: string
  ): Promise<PaymentIntent[]> {
    // Verificar se pedido existe
    const order = await orderRepository.getOrderById(tenantId, orderId);

    if (!order) {
      throw new Error(`Pedido não encontrado: ${orderId}`);
    }

    return await paymentIntentRepository.listIntentsByOrder(tenantId, orderId);
  }

  /**
   * Autoriza payment intent
   * 
   * Regras:
   * - Apenas muda status para AUTHORIZED
   * - Não executa transação bancária
   */
  async authorizePaymentIntent(
    tenantId: string,
    intentId: string
  ): Promise<PaymentIntent> {
    // Verificar se intent existe
    const intent = await paymentIntentRepository.getIntentById(tenantId, intentId);

    if (!intent) {
      throw new Error(`Payment intent não encontrado: ${intentId}`);
    }

    if (intent.status !== 'CREATED') {
      throw new Error(
        `Payment intent não pode ser autorizado. Status atual: ${intent.status}. Apenas CREATED pode ser autorizado.`
      );
    }

    // Apenas mudar status
    return await paymentIntentRepository.updateIntent(tenantId, intentId, {
      status: 'AUTHORIZED',
    });
  }

  /**
   * Cancela payment intent
   * 
   * Regras:
   * - Apenas muda status para CANCELLED
   * - Não executa rollback de nada
   */
  async cancelPaymentIntent(
    tenantId: string,
    intentId: string
  ): Promise<PaymentIntent> {
    // Verificar se intent existe
    const intent = await paymentIntentRepository.getIntentById(tenantId, intentId);

    if (!intent) {
      throw new Error(`Payment intent não encontrado: ${intentId}`);
    }

    if (intent.status === 'CANCELLED') {
      throw new Error('Payment intent já está cancelado');
    }

    if (intent.status === 'FAILED') {
      throw new Error('Payment intent já está em FAILED');
    }

    // Apenas mudar status
    return await paymentIntentRepository.updateIntent(tenantId, intentId, {
      status: 'CANCELLED',
    });
  }

  /**
   * Marca payment intent como falhado
   * 
   * Regras:
   * - Apenas muda status para FAILED
   * - Não executa rollback
   */
  async failPaymentIntent(
    tenantId: string,
    intentId: string
  ): Promise<PaymentIntent> {
    // Verificar se intent existe
    const intent = await paymentIntentRepository.getIntentById(tenantId, intentId);

    if (!intent) {
      throw new Error(`Payment intent não encontrado: ${intentId}`);
    }

    if (intent.status === 'FAILED') {
      throw new Error('Payment intent já está em FAILED');
    }

    if (intent.status === 'CANCELLED') {
      throw new Error('Payment intent está cancelado');
    }

    // Apenas mudar status
    return await paymentIntentRepository.updateIntent(tenantId, intentId, {
      status: 'FAILED',
    });
  }
}

export const paymentIntentService = new PaymentIntentService();

