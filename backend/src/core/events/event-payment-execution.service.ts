// backend/src/core/events/event-payment-execution.service.ts
// FASE 3 — Payment Execution: authorize, confirm, settle. sandbox_mode controla integração externa; ledger sempre real.
//
// Idempotência §4.12.1: dois efeitos irreversíveis → dois blocos `withIdempotency` distintos
// (`handler_name` diferente), para retry após falha a meio não duplicar ledger.

import { BadRequestError, NotFoundError } from '@core/errors';
import { bankPortsRegistry } from '@core/bank/ports-registry';
import { withIdempotency } from '@core/events/idempotency-tracker';
import { bankTransactionService } from '@modules/bank';
import type { FinancialAuthorshipContext } from '@modules/bank/financial-authorship.types';
import { eventPaymentPreparedService } from './event-payment-prepared.service';
import { eventCustodyService } from './event-custody.service';
import type { ExecutePaymentInput, ExecutePaymentResult } from './event-payment.types';

/** Tipo lógico do evento para chave canónica §4.12.1. */
const IDEMPOTENCY_EVENT_TYPE = 'event.payment.execution';

/** Efeito 1: escrita ledger (release escrow → owner). */
const HANDLER_LEDGER_RELEASE = 'event.payment.applyLedgerRelease';

/** Efeito 2: libertação de custódia + evento de domínio. */
const HANDLER_CUSTODY_RELEASE = 'event.payment.releaseCustody';

interface LedgerReleaseIdempotencyResult {
  transactionId: string;
}

class EventPaymentExecutionService {
  /**
   * Executa pagamento: valida autorização; sandbox_mode apenas controla integração externa; ledger sempre real.
   */
  async executePayment(
    tenantId: string,
    input: ExecutePaymentInput
  ): Promise<ExecutePaymentResult> {
    const { event_id, authorization_id, executed_by_actor_id, sandbox_mode } = input;

    const authorization = await eventPaymentPreparedService.getAuthorization(
      tenantId,
      authorization_id
    );
    if (!authorization) {
      throw new NotFoundError('Autorização não encontrada');
    }
    if (authorization.event_id !== event_id) {
      throw new BadRequestError('Autorização não pertence ao evento');
    }
    if (authorization.status !== 'authorized') {
      throw new BadRequestError(`Autorização não está autorizada (status: ${authorization.status})`);
    }

    const custody = await eventCustodyService.getCustody(tenantId, authorization.custody_id);
    if (!custody) {
      throw new NotFoundError('Custódia não encontrada');
    }
    if (custody.status !== 'active') {
      throw new BadRequestError(`Custódia não está ativa (status: ${custody.status})`);
    }

    const amountCents = custody.amount_cents;
    const bankAccount = bankPortsRegistry.getBankAccount();
    const escrowAccount = await bankAccount.getSystemAccount(tenantId, 'escrow', 'BRL');
    const ownerAccount = await bankAccount.getOrCreateAccount(tenantId, {
      ownerId: custody.economic_owner_id,
      ownerType: custody.economic_owner_type === 'user' ? 'user' : 'company',
      currency: 'BRL',
    });

    // Payload estável para hash de idempotência (sem timestamps — ver §4.12.1).
    const ledgerPayload = {
      event_id,
      authorization_id,
      executed_by_actor_id,
      sandbox_mode,
      amountCents,
      custody_id: custody.id,
      escrowAccountId: escrowAccount.accountId,
      ownerAccountId: ownerAccount.accountId,
    };

    // Chave canónica (semântica): event.payment.execution:${authorization_id}:event.payment.applyLedgerRelease
    const ledgerResult = await withIdempotency<LedgerReleaseIdempotencyResult>(
      tenantId,
      authorization_id,
      IDEMPOTENCY_EVENT_TYPE,
      HANDLER_LEDGER_RELEASE,
      ledgerPayload,
      async () => {
        const decidedAt = new Date().toISOString();
        const authorship: FinancialAuthorshipContext = {
          performedByUserId: null,
          actingForActorId: executed_by_actor_id,
          actingForAccountId: ownerAccount.accountId,
          authoritySource: 'system',
          permissionSnapshot: {
            permissionKey: 'event.payment.execute',
            allowed: true,
            actorId: executed_by_actor_id,
            userId: '',
            decidedAt,
          },
        };

        const tx = await bankTransactionService.createSimpleTransaction(tenantId, {
          eventId: authorization_id,
          referenceType: 'event_payment_release',
          fromAccountId: escrowAccount.accountId,
          toAccountId: ownerAccount.accountId,
          amountCents,
          currency: 'BRL',
          transactionType: 'release',
          description: `Liberação custódia evento ${event_id}, autorização ${authorization_id}`,
          metadata: { event_id, authorization_id, sandbox_mode },
          authorship,
        });
        return { transactionId: tx.transaction.transactionId };
      }
    );

    const custodyPayload = {
      event_id,
      authorization_id,
      custody_id: custody.id,
      sandbox_mode,
    };

    // Chave canónica (semântica): event.payment.execution:${authorization_id}:event.payment.releaseCustody
    await withIdempotency<{ released: true }>(
      tenantId,
      authorization_id,
      IDEMPOTENCY_EVENT_TYPE,
      HANDLER_CUSTODY_RELEASE,
      custodyPayload,
      async () => {
        await eventCustodyService.releaseCustody(
          tenantId,
          custody.id,
          sandbox_mode ? 'Execução em sandbox' : 'Pagamento executado'
        );
        return { released: true };
      }
    );

    const executionResult: ExecutePaymentResult = {
      executionId: ledgerResult.transactionId,
      eventId: event_id,
      authorizationId: authorization_id,
      amountCents,
      status: sandbox_mode ? 'simulated' : 'executed',
      sandboxMode: sandbox_mode,
    };

    return executionResult;
  }
}

export const eventPaymentExecutionService = new EventPaymentExecutionService();