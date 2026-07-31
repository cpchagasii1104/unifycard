// backend/src/modules/marketplace/accounts-receivable.service.ts
// SPRINT 71: ACCOUNTS RECEIVABLE (CONTAS A RECEBER)

import type {
  AccountsReceivable,
  CreateFromPaymentIntentInput,
  CreateManualReceivableInput,
  AccountsReceivableFilters,
} from './accounts-receivable.types';

/** Repo migrado para Bank - fail-fast até migração */
const accountsReceivableRepository = new Proxy({} as any, {
  get: () => () => Promise.reject(new Error('AccountsReceivable migrated to Bank')),
});

/**
 * Service para Contas a Receber
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Append-only: status muda, mas registros não desaparecem
 * - Status declarativos
 * - Audit em todas as mudanças
 * - Accounts Receivable ≠ Payment
 * - Accounts Receivable ≠ Ledger
 * - Nenhuma movimentação financeira
 * - Representa direito de recebimento futuro
 */
class AccountsReceivableService {
  /**
   * Cria conta a receber a partir de Payment Intent
   * 
   * SPRINT 71: Chamado automaticamente quando payment é SUCCESS
   */
  async createFromPaymentIntent(
    tenantId: string,
    input: CreateFromPaymentIntentInput,
    createdByActorId: string,
    createdByUserId?: string
  ): Promise<AccountsReceivable> {
    // Validar que payment intent existe e está SUCCESS
    const { paymentIntentService } = await import('./payment-intent.service');
    const intent = await paymentIntentService.getIntentById(tenantId, input.paymentIntentId);

    if (!intent) {
      throw new Error(`Payment Intent não encontrado: ${input.paymentIntentId}`);
    }

    if (intent.status !== 'AUTHORIZED') {
      throw new Error(`Payment Intent não está autorizado (status: ${intent.status})`);
    }

    // Converter expectedAt se necessário
    const expectedAt = input.expectedAt instanceof Date ? input.expectedAt : new Date(input.expectedAt);

    // SPRINT 72: Extrair payment method do intent metadata se disponível
    let paymentMethod: string | null = input.paymentMethod || null;
    if (!paymentMethod && intent.metadata?.payment_method_snapshot) {
      paymentMethod = intent.metadata.payment_method_snapshot.type;
    }

    // Criar conta a receber
    const receivable = await accountsReceivableRepository.createReceivable(tenantId, {
      actorId: input.actorId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      amountCents: input.amountCents,
      currency: input.currency || 'BRL',
      expectedAt,
      paymentMethod,
      createdByActorId,
      createdByUserId: createdByUserId || null,
      metadata: {
        ...input.metadata,
        payment_intent_id: input.paymentIntentId,
        order_id: intent.orderId,
        payment_method_id: intent.metadata?.payment_method_id,
        payment_method_snapshot: intent.metadata?.payment_method_snapshot,
        // SPRINT 73: Referência à transação UnifyCard se existir
        unifycard_transaction_id: intent.metadata?.unifycard_transaction_id,
      },
    });

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'ACCOUNTS_RECEIVABLE_CREATED_FROM_PAYMENT',
      receivableId: receivable.id,
      paymentIntentId: input.paymentIntentId,
      status: receivable.status,
      createdByActorId,
      createdByUserId,
    });

    return receivable;
  }

  /**
   * Cria conta a receber manual
   */
  async createManualReceivable(
    tenantId: string,
    input: CreateManualReceivableInput,
    createdByActorId: string,
    createdByUserId?: string
  ): Promise<AccountsReceivable> {
    // Converter expectedAt se necessário
    const expectedAt = input.expectedAt instanceof Date ? input.expectedAt : new Date(input.expectedAt);

    // Criar conta a receber
    const receivable = await accountsReceivableRepository.createReceivable(tenantId, {
      actorId: input.actorId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      amountCents: input.amountCents,
      currency: input.currency || 'BRL',
      expectedAt,
      paymentMethod: input.paymentMethod || null,
      createdByActorId,
      createdByUserId: createdByUserId || null,
      metadata: {
        ...input.metadata,
        description: input.description,
        manual: true,
      },
    });

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'ACCOUNTS_RECEIVABLE_CREATED_MANUAL',
      receivableId: receivable.id,
      status: receivable.status,
      createdByActorId,
      createdByUserId,
    });

    return receivable;
  }

  /**
   * Marca conta como recebida
   */
  async markAsReceived(
    tenantId: string,
    receivableId: string,
    receivedByActorId: string,
    receivedByUserId?: string
  ): Promise<AccountsReceivable> {
    // Buscar conta
    const receivable = await accountsReceivableRepository.getReceivableById(tenantId, receivableId);
    if (!receivable) {
      throw new Error(`Conta não encontrada: ${receivableId}`);
    }

    if (receivable.status !== 'PENDING') {
      throw new Error(`Conta não está em PENDING (status: ${receivable.status})`);
    }

    // Marcar como recebida
    const receivedReceivable = await accountsReceivableRepository.markAsReceived(
      tenantId,
      receivableId,
      receivedByActorId,
      receivedByUserId || null
    );

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'ACCOUNTS_RECEIVABLE_RECEIVED',
      receivableId: receivedReceivable.id,
      status: receivedReceivable.status,
      receivedByActorId,
      receivedByUserId,
    });

    return receivedReceivable;
  }

  /**
   * Cancela conta a receber
   */
  async cancelReceivable(
    tenantId: string,
    receivableId: string,
    cancelledByActorId: string,
    cancelledByUserId?: string,
    cancellationReason?: string
  ): Promise<AccountsReceivable> {
    // Buscar conta
    const receivable = await accountsReceivableRepository.getReceivableById(tenantId, receivableId);
    if (!receivable) {
      throw new Error(`Conta não encontrada: ${receivableId}`);
    }

    if (receivable.status !== 'PENDING') {
      throw new Error(`Conta não pode ser cancelada (status: ${receivable.status})`);
    }

    // Cancelar conta
    const cancelledReceivable = await accountsReceivableRepository.cancelReceivable(
      tenantId,
      receivableId,
      cancelledByActorId,
      cancelledByUserId || null,
      cancellationReason || null
    );

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'ACCOUNTS_RECEIVABLE_CANCELLED',
      receivableId: cancelledReceivable.id,
      status: cancelledReceivable.status,
      cancelledByActorId,
      cancelledByUserId,
      cancellationReason,
    });

    return cancelledReceivable;
  }

  /**
   * Lista contas com filtros
   */
  async listReceivables(tenantId: string, filters: AccountsReceivableFilters = {}): Promise<AccountsReceivable[]> {
    return await accountsReceivableRepository.listReceivables(tenantId, filters);
  }

  /**
   * Busca conta por ID
   */
  async getReceivableById(tenantId: string, receivableId: string): Promise<AccountsReceivable | null> {
    return await accountsReceivableRepository.getReceivableById(tenantId, receivableId);
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
      receivableId: string;
      paymentIntentId?: string;
      status?: string;
      createdByActorId?: string;
      createdByUserId?: string | null;
      receivedByActorId?: string;
      receivedByUserId?: string | null;
      cancelledByActorId?: string;
      cancelledByUserId?: string | null;
      cancellationReason?: string | null;
    }
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: data.eventType,
        severity: 'WARNING',
        actor_id: (data.createdByActorId || data.receivedByActorId || data.cancelledByActorId) ?? undefined,
        actor_type: 'user',
        source: 'automation',
        context: {
          receivable_id: data.receivableId,
          payment_intent_id: data.paymentIntentId,
          status: data.status,
          created_by_user_id: data.createdByUserId ?? undefined,
          received_by_actor_id: data.receivedByActorId,
          received_by_user_id: data.receivedByUserId ?? undefined,
          cancelled_by_actor_id: data.cancelledByActorId,
          cancelled_by_user_id: data.cancelledByUserId ?? undefined,
          cancellation_reason: data.cancellationReason ?? undefined,
        },
      });
    } catch (error) {
      // Não bloquear se auditoria falhar
      console.warn('[AccountsReceivable] Erro ao registrar auditoria:', error);
    }
  }
}

export const accountsReceivableService = new AccountsReceivableService();

