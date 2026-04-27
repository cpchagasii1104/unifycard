// LEGACY: Temporary wrapper for transaction service
// Delegates to bankTransactionService from @modules/bank
// FASE 5.5: transfer exige referenceType + referenceId (não há caminho silencioso).

import { bankTransactionService } from '@modules/bank/bank-transaction.service';
import { buildSystemAuthorship } from '@modules/bank/financial-authorship.helper';
import type { FinancialAuthorshipContext } from '@modules/bank/financial-authorship.types';
import type { BankTransaction } from '@modules/bank/bank-transaction.types';
import { v4 as uuidv4 } from 'uuid';

class TransactionService {
  // @system-context — motor interno de transferência. NÃO expor via rota HTTP.
  // Callers legítimos: distribution.service, split.service, social-work-payment.service, test-currency.service.
  // Confirmado em 2026-04-22: nenhuma rota HTTP deve chamar este método diretamente.
  // Ref: LEI §4.9.5; decisão arquitetural em docs/03_execution_log/2026-04-22-quadrinho-novos-achados.md
  async transfer(
    tenantId: string,
    input: {
      fromAccount: string;
      toAccount: string;
      amountCents: number;
      eventId?: string;
      /** Obrigatório (FASE 5.5). */
      referenceType: string;
      /** Obrigatório: id de domínio ou chave de idempotência. */
      referenceId: string;
      metadata?: Record<string, any>;
      /** C2: concept_id OBRIGATÓRIO — PROPAGATED from caller (DECISION-C2-010). */
      concept_id: string;
    }
  ) {
    const eventId = input.eventId ?? uuidv4();
    const authorship: FinancialAuthorshipContext = buildSystemAuthorship({
      actingForAccountId: input.fromAccount,
      actingForActorId: 'system',
    });

    return bankTransactionService.transfer(tenantId, {
      eventId,
      fromAccountId: input.fromAccount,
      toAccountId: input.toAccount,
      amountCents: input.amountCents,
      currency: 'BRL',
      transactionType: 'transfer',
      description: `Legacy transfer: ${eventId}`,
      metadata: input.metadata,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      authorship,
      concept_id: input.concept_id,
    });
  }

  async getTransactionById(
    tenantId: string,
    transactionId: string
  ): Promise<BankTransaction | null> {
    return bankTransactionService.getTransactionById(tenantId, transactionId);
  }

  /** Stub: retorna array vazio. Implementar quando houver mapeamento eventId → transações. */
  async getTransactionByEventId(
    _tenantId: string,
    _eventId: string
  ): Promise<BankTransaction | null> {
    return null;
  }

  /** Stub: retorna array vazio. Implementar quando listagem por conta estiver disponível. */
  async getTransactionsByAccount(
    _tenantId: string,
    _accountId: string,
    _opts?: { limit?: number; offset?: number }
  ): Promise<BankTransaction[]> {
    return [];
  }

  /** Stub: global user id não mapeado. Retorna array vazio. */
  async getTransactionsByGlobalUserId(
    _globalUserId: string,
    _opts?: { limit?: number }
  ): Promise<BankTransaction[]> {
    return [];
  }
}

export const transactionService = new TransactionService();
