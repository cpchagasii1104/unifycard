/**
 * Prompt 51 / 51.1 — Reversal Engine
 * Leituras SSOT do Unify Bank apenas via módulo Bank (transações, splits, ledger).
 */

import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
import { enqueueReconciliation } from '@core/events/payment-events-queue';
import { getClientWithTenant, runQueryWithTenant } from '@core/database/pool';
import { bankTransactionService } from '@modules/bank/bank-transaction.service';
import { bankAccountRepository } from '@modules/bank/bank-account.repository';
import {
  bankLedgerRepository,
  getAccountBalanceConsistent,
} from '@modules/bank/bank-ledger.repository';
import { bankSplitRepository } from '@modules/bank/bank-split.repository';
import { buildSystemAuthorship } from '@modules/bank/financial-authorship.helper';
import { logFinancialEvent } from '@core/observability/financial-logger';
import type { BankCurrency } from '@modules/bank/bank-account.types';
import { createPaymentIntent, getPaymentIntentByReference } from '@modules/payments/payment-intent-repository';
import {
  createReversalRequest,
  getReversalById,
  getByOriginalTransactionId,
  markFailed,
  resetFailedToPending,
  type CreateReversalRequestInput,
  type ReversalRow,
} from './reversal.repository';

export type { ReversalRow };

const REVERSAL_LEG_NAMESPACE = 'a3b5c7d9-e1f2-4a5b-8c9d-0e1f2a3b4c5d';

export async function requestReversal(
  tenantId: string,
  input: CreateReversalRequestInput
): Promise<ReversalRow> {
  const { requireFinancialRiskClearance } = await import('@modules/risk-identity/risk-financial-gate');
  await requireFinancialRiskClearance(tenantId, {
    actorId: input.actorId,
    action: 'financial_reversal_request',
    amountCents: input.amountCents,
  });
  const row = await createReversalRequest(tenantId, input);
  logFinancialEvent({
    financial_event: 'reversal_requested',
    tenant_id: tenantId,
    account_id: row.originalTransactionId,
    amount_cents: row.amountCents,
    metadata: { reversal_id: row.id, actor_id: row.actorId, reason: row.reason.slice(0, 200) },
  });
  return row;
}

async function recordReversalPaymentIntent(
  tenantId: string,
  rev: ReversalRow,
  origId: string,
  currency: string,
  reversalTransactionIds: string[]
): Promise<void> {
  const referenceId = `reversal-pipeline-${rev.id}`;
  try {
    const existing = await getPaymentIntentByReference(tenantId, referenceId);
    if (existing) return;
    await createPaymentIntent(tenantId, {
      referenceId,
      gateway: 'reversal_engine',
      actorId: rev.actorId,
      amountCents: rev.amountCents,
      currency,
      // DECISION-0032 Fase 1 + Clayton 2026-05-24 — convergência semântica, não literal.
      // O intent documenta um reversal já executado; o canônico correto é 'reversed' (presente
      // nos 11 valores válidos do CHECK), não 'settled' (mapping genérico da migration que valeria
      // para legacy data de payment_intent geral, não para o intent que registra a reversão).
      // Princípio: o nome tem que dizer a verdade do que a coisa é, não só passar no CHECK.
      status: 'reversed',
      metadata: {
        kind: 'financial_reversal_pipeline',
        reversal_id: rev.id,
        original_bank_transaction_id: origId,
        reversal_bank_transaction_ids: reversalTransactionIds,
        reason: rev.reason.slice(0, 500),
      },
    });
    logFinancialEvent({
      financial_event: 'reversal_payment_intent_recorded',
      tenant_id: tenantId,
      metadata: { reference_id: referenceId, reversal_id: rev.id },
    });
  } catch (e) {
    logFinancialEvent({
      financial_event: 'reversal_payment_intent_failed',
      tenant_id: tenantId,
      metadata: {
        reversal_id: rev.id,
        error: e instanceof Error ? e.message.slice(0, 300) : String(e),
      },
    });
  }
}

function legReferenceId(reversalId: string, splitId: string): string {
  return uuidv5(`${reversalId}:${splitId}`, REVERSAL_LEG_NAMESPACE);
}

export async function executeReversal(
  tenantId: string,
  reversalId: string
): Promise<{ reversalTransactionId: string; reversalTransactionIds: string[] }> {
  const rev = await getReversalById(tenantId, reversalId);
  if (!rev) throw new Error('REVERSAL_NOT_FOUND');
  if (rev.status === 'executed' && rev.reversalTransactionId) {
    try {
      const row = await runQueryWithTenant<{ ids: string[] | null }>(
        tenantId,
        `SELECT reversal_transaction_ids AS ids FROM reversals WHERE id = $1`,
        [reversalId]
      );
      const ids = row?.ids?.filter(Boolean);
      const list = ids?.length ? ids : [rev.reversalTransactionId];
      return { reversalTransactionId: rev.reversalTransactionId, reversalTransactionIds: list };
    } catch {
      return {
        reversalTransactionId: rev.reversalTransactionId,
        reversalTransactionIds: [rev.reversalTransactionId],
      };
    }
  }
  if (rev.status !== 'processing') {
    throw new Error(`REVERSAL_INVALID_STATE:${rev.status}`);
  }

  const client = await getClientWithTenant(tenantId);
  try {
    await client.query('BEGIN');

    const revLock = await client.query<{ status: string }>(
      `SELECT status FROM reversals WHERE tenant_id = $1 AND id = $2 FOR UPDATE`,
      [tenantId, reversalId]
    );
    if (revLock.rows.length === 0 || revLock.rows[0].status !== 'processing') {
      await client.query('ROLLBACK');
      throw new Error('REVERSAL_CONCURRENT_STATE_CHANGE');
    }

    const origId = rev.originalTransactionId;

    const locked = await bankTransactionService.getTransactionLockedForReversal(
      client,
      tenantId,
      origId
    );
    if (!locked) {
      await client.query('ROLLBACK');
      throw new Error('ORIGINAL_TRANSACTION_NOT_FOUND');
    }

    if (!locked.internal_completed_at) {
      await client.query('ROLLBACK');
      throw new Error('ORIGINAL_TRANSACTION_NOT_COMPLETED');
    }
    if (locked.reference_type === 'financial_reversal') {
      await client.query('ROLLBACK');
      throw new Error('REVERSAL_OF_REVERSAL_NOT_SUPPORTED');
    }

    const totalCents = locked.amount_cents;
    if (totalCents !== rev.amountCents) {
      await client.query('ROLLBACK');
      throw new Error('REVERSAL_AMOUNT_MISMATCH_BANK_TRANSACTION');
    }

    const payerAccountId = locked.account_id;
    const splitRows = await bankSplitRepository.loadSplitLegsForReversal(client, tenantId, origId);
    const executedTxIds: string[] = [];

    const payerAcc = await bankAccountRepository.getAccountById(tenantId, payerAccountId);
    if (!payerAcc) {
      await client.query('ROLLBACK');
      throw new Error('PAYER_ACCOUNT_NOT_FOUND');
    }
    const currency = payerAcc.currency as BankCurrency;

    if (splitRows.length > 0) {
      const sumLegs = splitRows.reduce((s, x) => s + x.amount_cents, 0);
      if (sumLegs !== totalCents) {
        await client.query('ROLLBACK');
        throw new Error('REVERSAL_SPLIT_SUM_MISMATCH');
      }
      const orderedTargets = [...new Set(splitRows.map((s) => s.target_account_id))].sort();
      await bankTransactionService.lockBankAccountsOrdered(client, tenantId, [
        payerAccountId,
        ...orderedTargets,
      ]);
      for (const leg of splitRows) {
        const fromAccountId = leg.target_account_id;
        const toAccountId = payerAccountId;
        const fromAcc = await bankAccountRepository.getAccountById(tenantId, fromAccountId);
        if (!fromAcc || fromAcc.currency !== currency) {
          await client.query('ROLLBACK');
          throw new Error('LEG_ACCOUNT_INVALID');
        }
        const bal = await getAccountBalanceConsistent(tenantId, fromAccountId, client);
        if (bal.balanceCents < leg.amount_cents) {
          await client.query('ROLLBACK');
          throw new Error('INSUFFICIENT_FUNDS_FOR_REVERSAL');
        }
        const treasurySource =
          fromAcc.ownerType === 'system' ? ('treasury:reversal' as const) : undefined;
        const tr = await bankTransactionService.transfer(
          tenantId,
          {
            eventId: uuidv4(),
            fromAccountId,
            toAccountId,
            amountCents: leg.amount_cents,
            currency,
            transactionType: 'transfer',
            description: `Financial reversal leg (original ${origId})`,
            // DECISION-0052 Bloco E: rastreabilidade canônica.
            // NOTA: o método bankTransactionService.transfer hoje NÃO propaga
            // metadata para bank_transactions (o INSERT não inclui a coluna).
            // Logo, persistimos via UPDATE explícito ABAIXO do transfer.
            metadata: {
              reversal_id: reversalId,
              original_transaction_id: origId,
              original_split_id: leg.split_id,
            },
            referenceType: 'financial_reversal_leg',
            referenceId: legReferenceId(reversalId, leg.split_id),
            authorship: buildSystemAuthorship({ actingForAccountId: fromAccountId }),
            concept_id: 'transaction-reversal-leg',
            treasurySource,
          },
          client
        );
        // DECISION-0052 Bloco E: persiste rastreabilidade canônica em
        // bank_transactions.metadata da leg via método dedicado do módulo
        // bank (bank-ledger §4.6 — escritas bank_* só em modules/bank/).
        await bankTransactionService.appendReversalLegMetadata(
          tenantId,
          tr.transactionId,
          {
            reversal_id: reversalId,
            original_transaction_id: origId,
            original_split_id: leg.split_id,
          },
          client
        );
        executedTxIds.push(tr.transactionId);
      }
    } else {
      let counterpartAccountId = locked.counterpart_account_id;
      if (!counterpartAccountId) {
        try {
          counterpartAccountId = await bankLedgerRepository.getCreditAccountIdForReversalLedgerFallback(
            tenantId,
            origId,
            client
          );
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        }
        logFinancialEvent({
          financial_event: 'reversal_counterparty_ledger_fallback',
          tenant_id: tenantId,
          metadata: { original_transaction_id: origId },
        });
      }
      const fromAccountId = counterpartAccountId;
      const toAccountId = payerAccountId;
      await bankTransactionService.lockBankAccountsOrdered(client, tenantId, [
        fromAccountId,
        toAccountId,
      ]);
      const fromAccount = await bankAccountRepository.getAccountById(tenantId, fromAccountId);
      if (!fromAccount || fromAccount.currency !== currency) {
        await client.query('ROLLBACK');
        throw new Error('ACCOUNT_NOT_FOUND');
      }
      const bal = await getAccountBalanceConsistent(tenantId, fromAccountId, client);
      if (bal.balanceCents < totalCents) {
        await client.query('ROLLBACK');
        throw new Error('INSUFFICIENT_FUNDS_FOR_REVERSAL');
      }
      const treasurySource =
        fromAccount.ownerType === 'system' ? ('treasury:reversal' as const) : undefined;
      const tr = await bankTransactionService.transfer(
        tenantId,
        {
          eventId: uuidv4(),
          fromAccountId,
          toAccountId,
          amountCents: totalCents,
          currency,
          transactionType: 'transfer',
          description: `Financial reversal (original tx ${origId})`,
          metadata: { reversal_id: reversalId, original_transaction_id: origId },
          referenceType: 'financial_reversal',
          referenceId: reversalId,
          authorship: buildSystemAuthorship({ actingForAccountId: fromAccountId }),
          treasurySource,
          concept_id: 'transaction-reversal',
        },
        client
      );
      executedTxIds.push(tr.transactionId);
    }

    const primaryId = executedTxIds[0]!;
    try {
      await client.query(
        `UPDATE reversals
         SET status = 'executed',
             reversal_transaction_id = $1,
             reversal_transaction_ids = $2,
             processed_at = now()
         WHERE tenant_id = $3 AND id = $4`,
        [primaryId, executedTxIds, tenantId, reversalId]
      );
    } catch {
      await client.query(
        `UPDATE reversals
         SET status = 'executed', reversal_transaction_id = $1, processed_at = now()
         WHERE tenant_id = $2 AND id = $3`,
        [primaryId, tenantId, reversalId]
      );
    }

    await client.query('COMMIT');

    enqueueReconciliation({
      tenant_id: tenantId,
      reference_type: 'bank_transaction',
      reference_id: primaryId,
    });

    logFinancialEvent({
      financial_event: 'reversal_executed',
      tenant_id: tenantId,
      transaction_id: primaryId,
      account_id: payerAccountId,
      amount_cents: rev.amountCents,
      metadata: {
        reversal_id: reversalId,
        original_transaction_id: origId,
        reversal_transaction_ids: executedTxIds,
      },
    });

    const { recordActorRiskEventAsync } = await import('@modules/risk-identity/risk-hooks');
    recordActorRiskEventAsync(tenantId, rev.actorId, 'reversal_executed', reversalId, {
      original_transaction_id: origId,
      reversal_transaction_id: primaryId,
    });

    await recordReversalPaymentIntent(tenantId, rev, origId, currency, executedTxIds);

    return { reversalTransactionId: primaryId, reversalTransactionIds: executedTxIds };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    const msg = e instanceof Error ? e.message : String(e);
    await markFailed(tenantId, reversalId, msg);
    logFinancialEvent({
      financial_event: 'reversal_failed',
      tenant_id: tenantId,
      metadata: { reversal_id: reversalId, error: msg.slice(0, 500) },
    });
    throw e;
  } finally {
    client.release();
  }
}

export async function requestAndExecuteReversalSync(
  tenantId: string,
  input: CreateReversalRequestInput
): Promise<{ reversalTransactionId: string; reversalTransactionIds: string[] }> {
  const existing = await getByOriginalTransactionId(tenantId, input.originalTransactionId);
  if (existing?.status === 'executed' && existing.reversalTransactionId) {
    return executeReversal(tenantId, existing.id);
  }
  let reversalId: string;
  if (!existing) {
    const { requireFinancialRiskClearance } = await import('@modules/risk-identity/risk-financial-gate');
    await requireFinancialRiskClearance(tenantId, {
      actorId: input.actorId,
      action: 'financial_reversal_request',
      amountCents: input.amountCents,
    });
    const r = await createReversalRequest(tenantId, input);
    reversalId = r.id;
    logFinancialEvent({
      financial_event: 'reversal_requested',
      tenant_id: tenantId,
      metadata: { reversal_id: r.id, sync: true },
    });
  } else if (existing.status === 'failed') {
    await resetFailedToPending(tenantId, existing.id);
    reversalId = existing.id;
  } else if (existing.status === 'pending') {
    reversalId = existing.id;
  } else if (existing.status === 'processing') {
    throw new Error('REVERSAL_IN_PROGRESS');
  } else {
    reversalId = existing.id;
  }

  const up = await runQueryWithTenant<{ id: string }>(
    tenantId,
    `UPDATE reversals SET status = 'processing' WHERE tenant_id = $1 AND id = $2 AND status = 'pending' RETURNING id`,
    [tenantId, reversalId]
  );
  if (!up) {
    const ag = await getByOriginalTransactionId(tenantId, input.originalTransactionId);
    if (ag?.status === 'executed' && ag.reversalTransactionId) {
      return executeReversal(tenantId, ag.id);
    }
    throw new Error('REVERSAL_STATE_CONFLICT');
  }
  return executeReversal(tenantId, reversalId);
}