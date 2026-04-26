// INFRA-4.1 — Compensação financeira: nova transação inversa; ledger original imutável.

import { v4 as uuidv4 } from 'uuid';
import { getClientWithTenant } from '@core/database/pool';
import { runQueryWithTenant } from '@core/database/pool';
import { insertEventOutboxRow, outboxEventIdFromSeed } from '@core/events/event-outbox.repository';
import { canonicalLogger } from '@core/logging/canonical-logger';
import { bankLedgerRepository } from '@modules/bank/bank-ledger.repository';
import { bankTransactionService } from '@modules/bank/bank-transaction.service';
import { bankAccountRepository } from '@modules/bank/bank-account.repository';
import { buildSystemAuthorship } from '@modules/bank/financial-authorship.helper';
import type { BankCurrency } from '@modules/bank/bank-account.types';

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === '23505';
}

export type CompensateTransactionResult = {
  compensationTransactionId: string;
  alreadyExisted: boolean;
};

/**
 * Cria transferência inversa (B→A) para transação original A→B, regista ledger_compensations e outbox.
 * Não altera linhas do ledger original.
 *
 * Nota: `bankTransactionService.transfer` gere a sua própria transação SQL; depois persistimos compensação+outbox
 * numa segunda transação (evita ROLLBACK interno do transfer a abortar o BEGIN externo).
 */
export async function compensateTransaction(
  tenantId: string,
  originalTransactionId: string,
  reason: string
): Promise<CompensateTransactionResult> {
  if (!reason || !reason.trim()) {
    canonicalLogger.error(null, 'ledger_compensation_failed', {
      metric_event: 'ledger_compensation_failed',
      tenantId,
      sagaFromStatus: '_na',
      sagaToStatus: '_na',
      compensationError: 'REASON_REQUIRED',
    });
    throw new Error('COMPENSATION_REASON_REQUIRED');
  }

  const existingEarly = await runQueryWithTenant<{ compensation_transaction_id: string }>(
    tenantId,
    `SELECT compensation_transaction_id FROM ledger_compensations
     WHERE tenant_id = $1::uuid AND original_transaction_id = $2::uuid LIMIT 1`,
    [tenantId, originalTransactionId]
  );
  if (existingEarly) {
    return {
      compensationTransactionId: existingEarly.compensation_transaction_id,
      alreadyExisted: true,
    };
  }

  const locked = await runQueryWithTenant<{
    account_id: string;
    amount_cents: string;
    internal_completed_at: Date | null;
    reference_type: string | null;
  }>(
    tenantId,
    `
    SELECT account_id, amount_cents::text, internal_completed_at, reference_type
    FROM bank_transactions
    WHERE tenant_id = $1::uuid AND id = $2::uuid
    LIMIT 1
    `,
    [tenantId, originalTransactionId]
  );

  if (!locked) {
    canonicalLogger.error(null, 'ledger_compensation_failed', {
      metric_event: 'ledger_compensation_failed',
      tenantId,
      sagaFromStatus: '_na',
      sagaToStatus: '_na',
      compensationError: 'ORIGINAL_NOT_FOUND',
    });
    throw new Error('COMPENSATION_ORIGINAL_NOT_FOUND');
  }

  if (!locked.internal_completed_at) {
    canonicalLogger.error(null, 'ledger_compensation_failed', {
      metric_event: 'ledger_compensation_failed',
      tenantId,
      sagaFromStatus: '_na',
      sagaToStatus: '_na',
      compensationError: 'ORIGINAL_NOT_COMPLETED',
    });
    throw new Error('COMPENSATION_ORIGINAL_NOT_COMPLETED');
  }

  const rt = (locked.reference_type ?? '').trim();
  if (rt === 'ledger_compensation' || rt === 'financial_reversal') {
    canonicalLogger.error(null, 'ledger_compensation_failed', {
      metric_event: 'ledger_compensation_failed',
      tenantId,
      sagaFromStatus: '_na',
      sagaToStatus: '_na',
      compensationError: 'ORIGINAL_NOT_COMPENSATABLE_TYPE',
    });
    throw new Error('COMPENSATION_ORIGINAL_NOT_COMPENSATABLE');
  }

  const amountCents = Number(locked.amount_cents);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    canonicalLogger.error(null, 'ledger_compensation_failed', {
      metric_event: 'ledger_compensation_failed',
      tenantId,
      sagaFromStatus: '_na',
      sagaToStatus: '_na',
      compensationError: 'INVALID_AMOUNT',
    });
    throw new Error('COMPENSATION_INVALID_AMOUNT');
  }

  const entries = await bankLedgerRepository.getEntriesByTransaction(tenantId, originalTransactionId);
  if (entries.length !== 2) {
    canonicalLogger.error(null, 'ledger_compensation_failed', {
      metric_event: 'ledger_compensation_failed',
      tenantId,
      sagaFromStatus: '_na',
      sagaToStatus: '_na',
      compensationError: 'LEDGER_LEGS_NOT_TWO',
    });
    throw new Error('COMPENSATION_UNSUPPORTED_LEDGER_SHAPE');
  }

  const debitEntry = entries.find((e) => e.entryType === 'debit');
  const creditEntry = entries.find((e) => e.entryType === 'credit');
  if (!debitEntry || !creditEntry) {
    canonicalLogger.error(null, 'ledger_compensation_failed', {
      metric_event: 'ledger_compensation_failed',
      tenantId,
      sagaFromStatus: '_na',
      sagaToStatus: '_na',
      compensationError: 'MISSING_DEBIT_OR_CREDIT',
    });
    throw new Error('COMPENSATION_MISSING_DEBIT_OR_CREDIT');
  }

  const originalPayerAccountId = debitEntry.accountId;
  const originalReceiverAccountId = creditEntry.accountId;

  const fromAcc = await bankAccountRepository.getAccountById(tenantId, originalReceiverAccountId);
  const toAcc = await bankAccountRepository.getAccountById(tenantId, originalPayerAccountId);
  if (!fromAcc || !toAcc) {
    canonicalLogger.error(null, 'ledger_compensation_failed', {
      metric_event: 'ledger_compensation_failed',
      tenantId,
      sagaFromStatus: '_na',
      sagaToStatus: '_na',
      compensationError: 'ACCOUNT_NOT_FOUND',
    });
    throw new Error('COMPENSATION_ACCOUNT_NOT_FOUND');
  }

  const cFrom = fromAcc.currency as BankCurrency;
  const cTo = toAcc.currency as BankCurrency;
  if (cFrom !== cTo) {
    canonicalLogger.error(null, 'ledger_compensation_failed', {
      metric_event: 'ledger_compensation_failed',
      tenantId,
      sagaFromStatus: '_na',
      sagaToStatus: '_na',
      compensationError: 'CURRENCY_MISMATCH',
    });
    throw new Error('COMPENSATION_CURRENCY_MISMATCH');
  }

  const authorship = buildSystemAuthorship({
    actingForAccountId: originalReceiverAccountId,
    actingForActorId: fromAcc.actorId ?? undefined,
  });

  const transferResult = await bankTransactionService.transfer(tenantId, {
    eventId: uuidv4(),
    fromAccountId: originalReceiverAccountId,
    toAccountId: originalPayerAccountId,
    amountCents,
    currency: cFrom,
    transactionType: 'transfer',
    referenceType: 'ledger_compensation',
    referenceId: originalTransactionId,
    description: `Ledger compensation (inverse of ${originalTransactionId}): ${reason}`.slice(0, 2_000),
    authorship,
  });

  const compensationTransactionId = transferResult.transactionId;

  const client = await getClientWithTenant(tenantId);
  try {
    await client.query('BEGIN');
    try {
      await client.query(
        `
        INSERT INTO ledger_compensations (
          tenant_id, original_transaction_id, compensation_transaction_id, reason
        )
        VALUES ($1::uuid, $2::uuid, $3::uuid, $4)
        `,
        [tenantId, originalTransactionId, compensationTransactionId, reason.trim()]
      );
    } catch (insErr) {
      if (isUniqueViolation(insErr)) {
        await client.query('ROLLBACK');
        const row = await runQueryWithTenant<{ compensation_transaction_id: string }>(
          tenantId,
          `SELECT compensation_transaction_id FROM ledger_compensations
           WHERE tenant_id = $1::uuid AND original_transaction_id = $2::uuid LIMIT 1`,
          [tenantId, originalTransactionId]
        );
        if (row) {
          const repair = await getClientWithTenant(tenantId);
          try {
            await repair.query('BEGIN');
            await insertEventOutboxRow(repair, {
              tenantId,
              eventId: outboxEventIdFromSeed(`ledger.compensation:${tenantId}:${originalTransactionId}`),
              eventType: 'ledger.transaction.compensated',
              eventVersion: 1,
              payload: {
                originalTransactionId,
                compensationTransactionId: row.compensation_transaction_id,
                reason: reason.trim().slice(0, 2_000),
              },
            });
            await repair.query('COMMIT');
          } catch {
            await repair.query('ROLLBACK');
          } finally {
            repair.release();
          }
          return { compensationTransactionId: row.compensation_transaction_id, alreadyExisted: true };
        }
      }
      throw insErr;
    }

    await insertEventOutboxRow(client, {
      tenantId,
      eventId: outboxEventIdFromSeed(`ledger.compensation:${tenantId}:${originalTransactionId}`),
      eventType: 'ledger.transaction.compensated',
      eventVersion: 1,
      payload: {
        originalTransactionId,
        compensationTransactionId,
        reason: reason.trim().slice(0, 2_000),
      },
    });

    await client.query('COMMIT');

    canonicalLogger.info(null, 'ledger_compensation_created', {
      metric_event: 'ledger_compensation_created',
      tenantId,
      sagaFromStatus: '_na',
      sagaToStatus: '_na',
      originalTransactionId,
      compensationTransactionId,
    });

    return { compensationTransactionId, alreadyExisted: false };
  } catch (e) {
    await client.query('ROLLBACK');
    canonicalLogger.error(null, 'ledger_compensation_failed', {
      metric_event: 'ledger_compensation_failed',
      tenantId,
      sagaFromStatus: '_na',
      sagaToStatus: '_na',
      compensationError: (e as Error)?.message?.slice(0, 300) ?? 'unknown',
    });
    throw e;
  } finally {
    client.release();
  }
}