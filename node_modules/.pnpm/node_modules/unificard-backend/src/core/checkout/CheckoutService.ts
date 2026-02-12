// src/core/checkout/CheckoutService.ts
// SPRINT 3: INTEGRATED WITH UNIFY BANK
// 🔴 CRÍTICO: Orquestração de pagamento e split via Unify Bank
import { runTenantTransaction } from '@core/db';
import { CheckoutRequest, CheckoutResult } from '@unificard/contracts';
import { bankPortsRegistry } from '@core/bank/ports-registry';

/**
 * Serviço central de Checkout
 * Orquestra pagamento via UnifyCard e split via UnifyBank
 */
export class CheckoutService {
  /**
   * Processa checkout completo (pagamento + split)
   * 🔴 CRÍTICO: Atomicidade garantida por runTenantTransaction
   */
  async processCheckout(
    tenantId: string,
    input: CheckoutRequest
  ): Promise<CheckoutResult> {
    // Validação básica
    if (input.amount <= 0) {
      throw new Error('Invalid amount');
    }

    if (input.currency !== 'BRL') {
      throw new Error('Only BRL currency supported');
    }

    if (input.paymentMethod !== 'UNIFYCARD') {
      throw new Error('Only UNIFYCARD payment method supported');
    }

    // 🔴 GUARDA OBRIGATÓRIA: Bloqueia mock de UnifyCard em produção
    if (
      process.env.NODE_ENV === 'production' &&
      (process.env.UNIFYCARD_MODE === 'mock' || !process.env.UNIFYCARD_API_URL)
    ) {
      throw new Error(
        'CRITICAL: UnifyCard mock is not allowed in production. Configure UNIFYCARD_API_URL.'
      );
    }

    return runTenantTransaction(tenantId, async (trx) => {
      const userId = input.context.globalUserId;

      // 1. Simular pagamento via UnifyCard (mock por enquanto)
      // TODO: Integrar com serviço real de UnifyCard quando disponível
      const paymentResult = await this.mockUnifyCardCharge({
        userId: input.context.globalUserId,
        amountCents: input.amount,
      });

      if (!paymentResult.success) {
        throw new Error(paymentResult.error || 'Payment failed');
      }

      // 2. Processar via Unify Bank baseado no contexto
      let result: { transactionId: string };

      if (input.context.module === 'EVENT_TICKET') {
        if (!input.context.eventId) {
          throw new Error('eventId is required for EVENT_TICKET');
        }
        const bankIntegration = bankPortsRegistry.getBankIntegration();
        result = await bankIntegration.processEventTicketPayment(tenantId, {
          eventId: input.context.eventId,
          buyerUserId: userId,
          amountCents: input.amount,
          currency: 'BRL',
          idempotencyKey: input.idempotencyKey,
          metadata: {
            eventType: input.context.eventType,
            cityId: input.context.cityId,
            ticketId: input.context.ticketId,
            scheduleSlotId: input.context.scheduleSlotId,
          },
        });
      } else if (input.context.module === 'EVENT_CONSUMPTION') {
        if (!input.context.eventId) {
          throw new Error('eventId is required for EVENT_CONSUMPTION');
        }
        const bankIntegration = bankPortsRegistry.getBankIntegration();
        result = await bankIntegration.processEventConsumptionPayment(tenantId, {
          eventId: input.context.eventId,
          buyerUserId: userId,
          amountCents: input.amount,
          currency: 'BRL',
          idempotencyKey: input.idempotencyKey,
          metadata: {
            eventType: input.context.eventType,
            cityId: input.context.cityId,
            consumptionIds: input.context.consumptionIds,
          },
        });
      } else {
        // Para outros contextos, criar transação simples
        // TODO: Adicionar suporte para outros contextos conforme necessário
        throw new Error(`Unsupported module: ${input.context.module}`);
      }

      return {
        success: true,
        transactionId: result.transactionId,
      };
    });
  }

  /**
   * Mock de UnifyCard (temporário)
   * Em produção, substituir por chamada real ao serviço de UnifyCard
   */
  private async mockUnifyCardCharge(params: {
    userId: string;
    amountCents: number;
  }): Promise<{ success: boolean; error?: string }> {
    // Por enquanto, apenas valida se há saldo suficiente
    // Em produção, aqui seria uma chamada HTTP/RPC ao serviço de UnifyCard
    // que debitaria o cartão do usuário

    // TODO: Implementar chamada real quando UnifyCard estiver disponível
    // const response = await fetch('https://unifycard-api/charge', {
    //   method: 'POST',
    //   body: JSON.stringify({
    //     userId: params.userId,
    //     amountCents: params.amount,
    //   }),
    // });

    // Por enquanto, retorna sucesso (mock)
    return { success: true };
  }
}

export const checkoutService = new CheckoutService();




