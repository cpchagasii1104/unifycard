// backend/src/modules/marketplace/payment-split.service.ts
// SPRINT 40.1: MARKETPLACE EXECUÇÃO - Split Declarativo
// Service para splits declarativos de pagamento

import { paymentIntentService } from './payment-intent.service';
import type { PaymentSplit, CreatePaymentSplitInput, DefineSplitsInput } from './payment-split.types';

/** Repo migrado para Bank - fail-fast até migração */
const paymentSplitRepository = new Proxy({} as any, {
  get: () => () => Promise.reject(new Error('PaymentSplit migrated to Bank')),
});

/**
 * Service para payment splits
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Split é declarativo (não executa nada)
 * - Soma dos splits = intent.amountCents (validado)
 * - Só definir split para intent AUTHORIZED
 * - Não executar pagamento
 * - Não chamar Bank
 */
class PaymentSplitService {
  /**
   * Define splits para um payment intent
   * 
   * Regras:
   * - Só definir split para intent AUTHORIZED
   * - Validar soma (amount ou percentage)
   * - Não executar nada
   */
  async defineSplits(
    tenantId: string,
    paymentIntentId: string,
    input: DefineSplitsInput
  ): Promise<PaymentSplit[]> {
    // Verificar se intent existe e está AUTHORIZED
    const intent = await paymentIntentService.getIntentById(tenantId, paymentIntentId);

    if (!intent) {
      throw new Error(`Payment intent não encontrado: ${paymentIntentId}`);
    }

    if (intent.status !== 'AUTHORIZED') {
      throw new Error(
        `Splits só podem ser definidos para payment intents AUTHORIZED. Status atual: ${intent.status}`
      );
    }

    // Validar splits
    if (!input.splits || input.splits.length === 0) {
      throw new Error('Pelo menos um split deve ser definido');
    }

    // Validar cada split
    for (const split of input.splits) {
      if (split.amountCents <= 0) {
        throw new Error(`amountCents do split deve ser maior que zero`);
      }

      if (!split.recipientActorId) {
        throw new Error(`Recipient actor ID é obrigatório`);
      }

      if (!split.role) {
        throw new Error(`Role é obrigatório`);
      }
    }

    // Calcular soma dos amounts
    const totalAmount = input.splits.reduce((sum, split) => sum + split.amountCents, 0);

    // Validar soma = intent.amountCents (com tolerância de 1 centavo para arredondamento)
    const tolerance = 1; // 1 centavo
    if (Math.abs(totalAmount - intent.amountCents) > tolerance) {
      throw new Error(
        `Soma dos splits (${totalAmount}) não iguala o valor do intent (${intent.amountCents}). Diferença: ${Math.abs(totalAmount - intent.amountCents)}`
      );
    }

    // Remover splits existentes (permitir redefinição)
    await paymentSplitRepository.deleteSplitsByIntent(tenantId, paymentIntentId);

    // Criar novos splits
    const createdSplits: PaymentSplit[] = [];
    for (const splitInput of input.splits) {
      const split = await paymentSplitRepository.createSplit(
        tenantId,
        paymentIntentId,
        splitInput
      );
      createdSplits.push(split);
    }

    return createdSplits;
  }

  /**
   * Busca splits de um payment intent
   */
  async getSplitsByIntent(
    tenantId: string,
    paymentIntentId: string
  ): Promise<PaymentSplit[]> {
    // Verificar se intent existe
    const intent = await paymentIntentService.getIntentById(tenantId, paymentIntentId);

    if (!intent) {
      throw new Error(`Payment intent não encontrado: ${paymentIntentId}`);
    }

    return await paymentSplitRepository.listSplitsByIntent(tenantId, paymentIntentId);
  }

  /**
   * Valida se splits de um intent somam corretamente
   * (método auxiliar para validação)
   */
  async validateSplits(
    tenantId: string,
    paymentIntentId: string
  ): Promise<{ valid: boolean; totalSplits: number; intentAmount: number; difference: number }> {
    const intent = await paymentIntentService.getIntentById(tenantId, paymentIntentId);

    if (!intent) {
      throw new Error(`Payment intent não encontrado: ${paymentIntentId}`);
    }

    const totalSplits = await paymentSplitRepository.calculateTotalByIntent(
      tenantId,
      paymentIntentId
    );

    const difference = Math.abs(totalSplits - intent.amountCents);
    const tolerance = 1; // 1 centavo
    const valid = difference <= tolerance;

    return {
      valid,
      totalSplits,
      intentAmount: intent.amountCents,
      difference,
    };
  }
}

export const paymentSplitService = new PaymentSplitService();







