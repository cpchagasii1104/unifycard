// backend/src/modules/marketplace/unifycard.service.ts
// SPRINT 73: UNIFYCARD ACQUIRING (SIMULADO, CANÔNICO)

import type {
  UnifyCardTransaction,
  AuthorizeTransactionInput,
  CaptureTransactionInput,
  SettleTransactionInput,
  UnifyCardTransactionFilters,
} from './unifycard.types';

/** Repo migrado para Bank - fail-fast até migração */
const unifyCardRepository = new Proxy({} as any, {
  get: () => () => Promise.reject(new Error('UnifyCard migrated to Bank')),
});

/**
 * Service para UnifyCard Acquiring
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - UnifyCard ≠ Banco externo
 * - UnifyCard ≠ Visa/Mastercard
 * - Nenhuma integração externa real
 * - Nenhum dinheiro real
 * - Tudo auditável e reversível
 * - Nenhuma liquidação automática sem ação explícita
 */
class UnifyCardService {
  /**
   * Autoriza transação
   * 
   * SPRINT 73: Apenas cria registro, não executa nada
   */
  async authorize(
    tenantId: string,
    input: AuthorizeTransactionInput,
    actorId: string,
    createdByActorId: string,
    createdByUserId?: string
  ): Promise<UnifyCardTransaction> {
    // DECISION-0140/0141: taxa resolvida via economic_policy_engine (bps), NUNCA fee_percentage.
    // engine resolve; método no máximo espelha. Fail-closed: sem policy ⇒ fee=0 (sem fallback em percentage).
    const { resolveMarketplaceFeeViaPolicy } = await import('./marketplace-fee-policy');
    const feeResolution = await resolveMarketplaceFeeViaPolicy(tenantId, input.grossAmountCents);
    const feeAmountCents = feeResolution.feeAmountCents;
    const netAmountCents = feeResolution.netAmountCents;

    // Criar transação autorizada
    const transaction = await unifyCardRepository.createAuthorizedTransaction(tenantId, {
      actorId,
      paymentIntentId: input.paymentIntentId,
      paymentMethodId: input.paymentMethodId || null,
      transactionType: input.transactionType,
      grossAmountCents: input.grossAmountCents,
      feeAmountCents,
      netAmountCents,
      createdByActorId,
      createdByUserId: createdByUserId || null,
      metadata: {
        ...input.metadata,
        // DECISION-0141: snapshot auditável em bps (NÃO SSOT).
        fee_rate_bps: feeResolution.feeRateBps,
        fee_amount_cents: feeResolution.feeAmountCents,
        policy_id: feeResolution.policyId,
        policy_version: feeResolution.policyVersion,
      },
    });

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'UNIFYCARD_TRANSACTION_AUTHORIZED',
      transactionId: transaction.id,
      paymentIntentId: input.paymentIntentId,
      status: transaction.status,
      createdByActorId,
      createdByUserId,
    });

    return transaction;
  }

  /**
   * Captura transação
   * 
   * SPRINT 73: Apenas muda status, não executa nada
   */
  async capture(
    tenantId: string,
    input: CaptureTransactionInput,
    capturedByActorId: string,
    capturedByUserId?: string
  ): Promise<UnifyCardTransaction> {
    // Buscar transação
    const transaction = await unifyCardRepository.getTransactionById(tenantId, input.transactionId);
    if (!transaction) {
      throw new Error(`Transação não encontrada: ${input.transactionId}`);
    }

    if (transaction.status !== 'AUTHORIZED') {
      throw new Error(`Transação não está em AUTHORIZED (status: ${transaction.status})`);
    }

    // Marcar como capturada
    const capturedTransaction = await unifyCardRepository.markAsCaptured(tenantId, input.transactionId);

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'UNIFYCARD_TRANSACTION_CAPTURED',
      transactionId: capturedTransaction.id,
      status: capturedTransaction.status,
      capturedByActorId,
      capturedByUserId,
    });

    return capturedTransaction;
  }

  /**
   * Liquida transação
   * 
   * SPRINT 73: Move valor para conta regional (UnifyBank)
   * Futuro: criar entrada no ledger
   */
  async settle(
    tenantId: string,
    input: SettleTransactionInput,
    settledByActorId: string,
    settledByUserId?: string
  ): Promise<UnifyCardTransaction> {
    // Buscar transação
    const transaction = await unifyCardRepository.getTransactionById(tenantId, input.transactionId);
    if (!transaction) {
      throw new Error(`Transação não encontrada: ${input.transactionId}`);
    }

    if (transaction.status !== 'CAPTURED') {
      throw new Error(`Transação não está em CAPTURED (status: ${transaction.status})`);
    }

    // Marcar como liquidada
    const settledTransaction = await unifyCardRepository.markAsSettled(
      tenantId,
      input.transactionId,
      input.regionalAccountId
    );

    // SPRINT 73: Futuro - criar entrada no UnifyBank ledger
    // Por enquanto, apenas marca como SETTLED
    // TODO: Criar ledger entry quando UnifyBank estiver pronto

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'UNIFYCARD_TRANSACTION_SETTLED',
      transactionId: settledTransaction.id,
      regionalAccountId: input.regionalAccountId,
      status: settledTransaction.status,
      settledByActorId,
      settledByUserId,
    });

    return settledTransaction;
  }

  /**
   * Lista transações com filtros
   */
  async listTransactions(tenantId: string, filters: UnifyCardTransactionFilters = {}): Promise<UnifyCardTransaction[]> {
    return await unifyCardRepository.listTransactions(tenantId, filters);
  }

  /**
   * Busca transação por ID
   */
  async getTransactionById(tenantId: string, transactionId: string): Promise<UnifyCardTransaction | null> {
    return await unifyCardRepository.getTransactionById(tenantId, transactionId);
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
      transactionId: string;
      paymentIntentId?: string;
      regionalAccountId?: string;
      status?: string;
      createdByActorId?: string;
      createdByUserId?: string | null;
      capturedByActorId?: string;
      capturedByUserId?: string | null;
      settledByActorId?: string;
      settledByUserId?: string | null;
    }
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: data.eventType,
        severity: 'WARNING',
        actor_id: (data.createdByActorId || data.capturedByActorId || data.settledByActorId) ?? undefined,
        actor_type: 'user',
        source: 'unifycard',
        context: {
          transaction_id: data.transactionId,
          payment_intent_id: data.paymentIntentId,
          regional_account_id: data.regionalAccountId,
          status: data.status,
          created_by_user_id: data.createdByUserId ?? undefined,
          captured_by_actor_id: data.capturedByActorId,
          captured_by_user_id: data.capturedByUserId,
          settled_by_actor_id: data.settledByActorId,
          settled_by_user_id: data.settledByUserId,
        },
      });
    } catch (error) {
      // Não bloquear se auditoria falhar
      console.warn('[UnifyCard] Erro ao registrar auditoria:', error);
    }
  }
}

export const unifyCardService = new UnifyCardService();






