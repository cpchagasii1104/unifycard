// backend/src/modules/bank/bank-ledger.service.ts
// Bank fase 2 (B2B): liquidação b2b_payment_intents → 2× bank_transactions + bank_ledger (1 lançamento por transação, tenant isolado).
// Idempotência: UNIQUE(tenant_id, reference_type, reference_id) — tipos distintos para débito (buyer) e crédito (supplier).
// Correlação: reference_group_id = intent.id.

import type { PoolClient } from 'pg';
import { getClientWithTenant } from '@core/database/pool';
import { bankAccountRepository } from './bank-account.repository';
import { bankLedgerRepository } from './bank-ledger.repository';
import { logFinancialEvent } from '@core/observability/financial-logger';
import { incrementMetric } from '@core/observability/financial-metrics';
import {
  validateTransferLimit,
  validateDailyTransferLimit,
} from '@core/financial/transfer-limits';
import { lockAccount, unlockAccount } from '@core/financial/account-locks';
import { requireFinancialRiskClearance } from '@modules/risk-identity/risk-financial-gate';
import type { FinancialAuthorshipContext } from './financial-authorship.types';
import { asMoneyCents, toPositiveMoneyCents } from '@contracts/marketplace/canonical';
import { insertEventOutboxRow } from '@core/events/event-outbox.repository';
import { b2bPaymentCompletedEventId } from '@core/events/b2b-payment-event-id';
import { integerCentsFromDbWire } from './integer-cents-from-db';

/** reference_type no tenant comprador (débito) — idempotência por intent */
export const B2B_PAYMENT_INTENT_REFERENCE_TYPE_DEBIT = 'b2b_payment_intent_debit';
/** reference_type no tenant fornecedor (crédito) — idempotência por intent */
export const B2B_PAYMENT_INTENT_REFERENCE_TYPE_CREDIT = 'b2b_payment_intent_credit';

/** @deprecated usar B2B_PAYMENT_INTENT_REFERENCE_TYPE_DEBIT — mantido para testes/contratos legados */
export const B2B_PAYMENT_INTENT_REFERENCE_TYPE = B2B_PAYMENT_INTENT_REFERENCE_TYPE_DEBIT;

const LIMIT_AMOUNT_CENTS = 100_000_000;

function validateAmountCents(amountCents: number): void {
  if (amountCents > LIMIT_AMOUNT_CENTS) {
    throw new Error('AMOUNT_OVERFLOW');
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === '23505';
}

function isCoverageExceeded(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err);
  return m.includes('COVERAGE_EXCEEDED');
}

export interface B2bPaymentIntentRow {
  id: string;
  b2b_order_id: string;
  buyer_tenant_id: string;
  amount_cents: string | number;
  currency: string;
  status: string;
  bank_transaction_id: string | null;
  bank_transaction_supplier_id: string | null;
}

export interface CreateTransactionFromIntentInput {
  buyerTenantId: string;
  b2bOrderId: string;
  buyerBankAccountId: string;
  supplierBankAccountId: string;
  concept_id: string;
  authorship: FinancialAuthorshipContext;
}

export interface CreateTransactionFromIntentResult {
  intentId: string;
  orderId: string;
  /** Transação no tenant comprador (débito) */
  transactionId: string;
  /** Transação no tenant fornecedor (crédito); null se liquidação legada (1 tx cross-tenant) */
  supplierTransactionId: string | null;
  amountCents: number;
  currency: string;
  idempotentReplay: boolean;
}

async function loadIntentAndOrder(
  client: PoolClient,
  buyerTenantId: string,
  b2bOrderId: string
): Promise<{
  intent: B2bPaymentIntentRow;
  supplierTenantId: string;
} | null> {
  const res = await client.query<{
    id: string;
    b2b_order_id: string;
    buyer_tenant_id: string;
    amount_cents: string;
    currency: string;
    status: string;
    bank_transaction_id: string | null;
    bank_transaction_supplier_id: string | null;
    supplier_tenant_id: string;
  }>(
    `
    SELECT pi.id, pi.b2b_order_id, pi.buyer_tenant_id, pi.amount_cents, pi.currency, pi.status,
           pi.bank_transaction_id, pi.bank_transaction_supplier_id, o.supplier_tenant_id
    FROM b2b_payment_intents pi
    INNER JOIN b2b_orders o ON o.id = pi.b2b_order_id
    WHERE pi.b2b_order_id = $1
    FOR UPDATE OF pi
    `,
    [b2bOrderId]
  );
  const row = res.rows[0];
  if (!row) return null;
  if (row.buyer_tenant_id !== buyerTenantId) {
    throw new Error('B2B_PAYMENT_TENANT_MISMATCH');
  }
  return {
    intent: {
      id: row.id,
      b2b_order_id: row.b2b_order_id,
      buyer_tenant_id: row.buyer_tenant_id,
      amount_cents: row.amount_cents,
      currency: row.currency,
      status: row.status,
      bank_transaction_id: row.bank_transaction_id,
      bank_transaction_supplier_id: row.bank_transaction_supplier_id ?? null,
    },
    supplierTenantId: row.supplier_tenant_id,
  };
}

async function orderTotalCentsAndCurrency(
  client: PoolClient,
  b2bOrderId: string
): Promise<{ totalCents: number; currency: string; lineCount: number }> {
  const r = await client.query<{ total_cents: string; currency: string; line_count: string }>(
    `
    SELECT
      COALESCE(SUM(quantity::bigint * unit_price_cents), 0)::text AS total_cents,
      MAX(currency) AS currency,
      COUNT(*)::text AS line_count
    FROM b2b_order_items
    WHERE b2b_order_id = $1
    `,
    [b2bOrderId]
  );
  const row = r.rows[0];
  if (!row) return { totalCents: 0, currency: 'BRL', lineCount: 0 };
  const lineCount = parseInt(row.line_count, 10);
  const totalCents = parseInt(row.total_cents, 10);
  const curCheck = await client.query<{ ok: boolean }>(
    `SELECT BOOL_AND(currency = $2) AS ok FROM b2b_order_items WHERE b2b_order_id = $1`,
    [b2bOrderId, row.currency]
  );
  if (lineCount > 0 && curCheck.rows[0]?.ok === false) {
    throw new Error('B2B_ORDER_CURRENCY_MISMATCH');
  }
  return { totalCents, currency: row.currency || 'BRL', lineCount };
}

/** Uma linha de débito no mesmo tenant da transação */
async function ledgerHasSingleDebitForTx(
  client: PoolClient,
  tenantId: string,
  transactionId: string,
  expectedAccountId: string
): Promise<boolean> {
  const r = await client.query<{ c: string }>(
    `
    SELECT COUNT(*)::text AS c FROM bank_ledger
    WHERE tenant_id = $1 AND transaction_id = $2 AND direction = 'debit' AND account_id = $3
    `,
    [tenantId, transactionId, expectedAccountId]
  );
  return parseInt(r.rows[0]?.c ?? '0', 10) === 1;
}

/** Uma linha de crédito no mesmo tenant da transação */
async function ledgerHasSingleCreditForTx(
  client: PoolClient,
  tenantId: string,
  transactionId: string,
  expectedAccountId: string
): Promise<boolean> {
  const r = await client.query<{ c: string }>(
    `
    SELECT COUNT(*)::text AS c FROM bank_ledger
    WHERE tenant_id = $1 AND transaction_id = $2 AND direction = 'credit' AND account_id = $3
    `,
    [tenantId, transactionId, expectedAccountId]
  );
  return parseInt(r.rows[0]?.c ?? '0', 10) === 1;
}

/**
 * Validação explícita: conta do fornecedor pertence ao tenant do pedido.
 */
export async function assertSupplierBankAccountBelongsToTenant(
  client: PoolClient,
  supplierBankAccountId: string,
  supplierTenantId: string
): Promise<void> {
  const r = await client.query(`SELECT 1 FROM bank_accounts WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [
    supplierBankAccountId,
    supplierTenantId,
  ]);
  if (r.rowCount === 0) {
    throw new Error('B2B_SUPPLIER_ACCOUNT_TENANT_MISMATCH');
  }
}

/**
 * Liquida intent B2B: 2 transações (débito buyer / crédito supplier), cada uma só com ledger no seu tenant.
 */
export async function createTransactionFromIntent(
  input: CreateTransactionFromIntentInput
): Promise<CreateTransactionFromIntentResult> {
  const {
    buyerTenantId,
    b2bOrderId,
    buyerBankAccountId,
    supplierBankAccountId,
    concept_id,
    authorship,
  } = input;

  if (!authorship?.actingForActorId || !authorship?.actingForAccountId) {
    throw new Error('B2B_PAYMENT_AUTHORSHIP_REQUIRED');
  }

  // C2: concept_id obrigatório (runtime guard)
  if (input.concept_id === undefined) {
    throw new Error('CONCEPT_ID_REQUIRED: concept_id obrigatório em bank_transactions');
  }

  await lockAccount(buyerBankAccountId);
  const client = await getClientWithTenant(buyerTenantId);

  const maxAttempts = 3;

  try {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await client.query('BEGIN');

        const loaded = await loadIntentAndOrder(client, buyerTenantId, b2bOrderId);
        if (!loaded) {
          await client.query('ROLLBACK');
          throw new Error('B2B_PAYMENT_INTENT_NOT_FOUND');
        }

        const { intent, supplierTenantId } = loaded;
        const intentId = intent.id;
        const refId = intentId;
        const referenceGroupId = intentId;

        await client.query(
          `SELECT pg_advisory_xact_lock(hashtext($1::text), hashtext(($2 || $3)::text))`,
          [buyerTenantId, 'b2b_payment_intent', refId]
        );

        if (intent.status === 'completed' && intent.bank_transaction_id) {
          const legacy = !intent.bank_transaction_supplier_id;
          if (legacy) {
            await client.query('COMMIT');
            return {
              intentId,
              orderId: b2bOrderId,
              transactionId: intent.bank_transaction_id,
              supplierTransactionId: null,
              amountCents: integerCentsFromDbWire(intent.amount_cents, 'intent.amount_cents'),
              currency: intent.currency,
              idempotentReplay: true,
            };
          }
          await client.query('COMMIT');
          return {
            intentId,
            orderId: b2bOrderId,
            transactionId: intent.bank_transaction_id,
            supplierTransactionId: intent.bank_transaction_supplier_id!,
            amountCents: integerCentsFromDbWire(intent.amount_cents, 'intent.amount_cents'),
            currency: intent.currency,
            idempotentReplay: true,
          };
        }

        if (intent.status !== 'ready') {
          await client.query('ROLLBACK');
          throw new Error(`B2B_PAYMENT_INTENT_NOT_READY:${intent.status}`);
        }

        const { totalCents, currency: orderCurrency, lineCount } = await orderTotalCentsAndCurrency(
          client,
          b2bOrderId
        );
        if (lineCount === 0) {
          await client.query('ROLLBACK');
          throw new Error('B2B_ORDER_EMPTY');
        }

        const intentAmount = integerCentsFromDbWire(intent.amount_cents, 'intent.amount_cents');
        if (intentAmount !== totalCents) {
          await client.query('ROLLBACK');
          throw new Error('B2B_PAYMENT_AMOUNT_MISMATCH');
        }
        if (intent.currency.trim().toUpperCase() !== orderCurrency.trim().toUpperCase()) {
          await client.query('ROLLBACK');
          throw new Error('B2B_PAYMENT_CURRENCY_MISMATCH');
        }

        validateAmountCents(intentAmount);
        try {
          validateTransferLimit(intentAmount);
          validateDailyTransferLimit(buyerTenantId, authorship.actingForActorId, intentAmount);
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        }

        await assertSupplierBankAccountBelongsToTenant(client, supplierBankAccountId, supplierTenantId);

        const existingDebit = await client.query<{ id: string }>(
          `SELECT id FROM bank_transactions
           WHERE tenant_id = $1 AND reference_type = $2 AND reference_id = $3
           LIMIT 1 FOR UPDATE`,
          [buyerTenantId, B2B_PAYMENT_INTENT_REFERENCE_TYPE_DEBIT, refId]
        );

        const existingCredit = await client.query<{ id: string }>(
          `SELECT id FROM bank_transactions
           WHERE tenant_id = $1 AND reference_type = $2 AND reference_id = $3
           LIMIT 1 FOR UPDATE`,
          [supplierTenantId, B2B_PAYMENT_INTENT_REFERENCE_TYPE_CREDIT, refId]
        );

        const hasDebit = existingDebit.rows.length > 0;
        const hasCredit = existingCredit.rows.length > 0;

        if (hasDebit !== hasCredit) {
          await client.query('ROLLBACK');
          logFinancialEvent({
            financial_event: 'b2b_payment_settlement_partial',
            tenant_id: buyerTenantId,
            reference_id: refId,
            metadata: { has_debit: hasDebit, has_credit: hasCredit },
          });
          throw new Error('B2B_BANK_SETTLEMENT_INCOMPLETE');
        }

        if (hasDebit && hasCredit) {
          const buyerTxId = existingDebit.rows[0]!.id;
          const supplierTxId = existingCredit.rows[0]!.id;

          const debitOk = await ledgerHasSingleDebitForTx(
            client,
            buyerTenantId,
            buyerTxId,
            buyerBankAccountId
          );
          const creditOk = await ledgerHasSingleCreditForTx(
            client,
            supplierTenantId,
            supplierTxId,
            supplierBankAccountId
          );
          if (!debitOk || !creditOk) {
            await client.query('ROLLBACK');
            throw new Error('B2B_BANK_LEDGER_MISMATCH');
          }

          const up = await client.query<{ id: string }>(
            `UPDATE b2b_payment_intents
             SET status = 'completed',
                 bank_transaction_id = $2,
                 bank_transaction_supplier_id = $3,
                 updated_at = now()
             WHERE id = $1 AND status = 'ready'
             RETURNING id`,
            [intentId, buyerTxId, supplierTxId]
          );
          if (up.rows.length > 0) {
            await insertEventOutboxRow(client, {
              tenantId: buyerTenantId,
              eventId: b2bPaymentCompletedEventId(intentId),
              eventType: 'b2b.payment.completed',
              payload: {
                order_id: b2bOrderId,
                intent_id: intentId,
                transaction_id: buyerTxId,
                transaction_supplier_id: supplierTxId,
                reference_group_id: referenceGroupId,
                amount_cents: intentAmount,
                currency: intent.currency,
              },
            });
          }
          await client.query('COMMIT');

          return {
            intentId,
            orderId: b2bOrderId,
            transactionId: buyerTxId,
            supplierTransactionId: supplierTxId,
            amountCents: intentAmount,
            currency: intent.currency,
            idempotentReplay: up.rows.length === 0,
          };
        }

        const buyerAcc = await bankAccountRepository.getAccountById(buyerTenantId, buyerBankAccountId);
        const supplierAcc = await bankAccountRepository.getAccountById(
          supplierTenantId,
          supplierBankAccountId
        );
        if (!buyerAcc || !supplierAcc) {
          await client.query('ROLLBACK');
          throw new Error('B2B_BANK_ACCOUNT_NOT_FOUND');
        }
        if (buyerAcc.accountId !== authorship.actingForAccountId) {
          await client.query('ROLLBACK');
          throw new Error('B2B_PAYMENT_ACCOUNT_AUTHORSHIP_MISMATCH');
        }

        const debitActorId = buyerAcc.actorId;
        if (!debitActorId) {
          await client.query('ROLLBACK');
          throw new Error('RISK_DEBIT_ACTOR_UNRESOLVED');
        }
        const creditActorId = supplierAcc.actorId;
        if (!creditActorId) {
          await client.query('ROLLBACK');
          throw new Error('B2B_SUPPLIER_ACTOR_UNRESOLVED');
        }

        try {
          await requireFinancialRiskClearance(buyerTenantId, {
            actorId: debitActorId,
            action: 'financial_transfer',
            amountCents: intentAmount,
          });
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        }

        const fromBal = await bankLedgerRepository.calculateBalance(
          buyerTenantId,
          buyerBankAccountId,
          client
        );
        if (fromBal.balanceCents < intentAmount) {
          await client.query('ROLLBACK');
          incrementMetric('insufficient_funds_attempt');
          logFinancialEvent({
            financial_event: 'transaction_insufficient_funds',
            tenant_id: buyerTenantId,
            account_id: buyerBankAccountId,
            amount_cents: intentAmount,
          });
          throw new Error('INSUFFICIENT_FUNDS');
        }

        const toBal = await bankLedgerRepository.calculateBalance(
          supplierTenantId,
          supplierBankAccountId,
          client
        );

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        let buyerActorIdRow = authorship.actingForActorId;
        if (!uuidRegex.test(buyerActorIdRow)) {
          buyerActorIdRow = debitActorId;
        }
        if (!uuidRegex.test(buyerActorIdRow)) {
          const ar = await client.query<{ id: string }>(
            `SELECT id FROM actors WHERE tenant_id = $1 LIMIT 1`,
            [buyerTenantId]
          );
          buyerActorIdRow = ar.rows[0]?.id ?? '';
        }
        if (!uuidRegex.test(buyerActorIdRow)) {
          await client.query('ROLLBACK');
          throw new Error('B2B_PAYMENT_ACTOR_UNRESOLVED');
        }

        let supplierActorIdRow = creditActorId;
        if (!uuidRegex.test(supplierActorIdRow)) {
          const ars = await client.query<{ id: string }>(
            `SELECT id FROM actors WHERE tenant_id = $1 LIMIT 1`,
            [supplierTenantId]
          );
          supplierActorIdRow = ars.rows[0]?.id ?? '';
        }
        if (!uuidRegex.test(supplierActorIdRow)) {
          await client.query('ROLLBACK');
          throw new Error('B2B_SUPPLIER_ACTOR_UNRESOLVED');
        }

        const justification = `B2B supply order ${b2bOrderId} payment intent ${intentId}`;

        let buyerTxId: string;
        let supplierTxId: string;

        try {
          const insBuyer = await client.query<{ id: string }>(
            `
            INSERT INTO bank_transactions (
              tenant_id, actor_id, account_id, amount_cents, purpose, justification,
              reference_type, reference_id, counterpart_account_id, reference_group_id, concept_id
            )
            VALUES ($1, $2, $3, $4, 'execution', $5, $6, $7, $8, $9, $10)
            RETURNING id
            `,
            [
              buyerTenantId,
              buyerActorIdRow,
              buyerBankAccountId,
              intentAmount,
              justification,
              B2B_PAYMENT_INTENT_REFERENCE_TYPE_DEBIT,
              refId,
              supplierBankAccountId,
              referenceGroupId,
              concept_id,
            ]
          );
          buyerTxId = insBuyer.rows[0]!.id;
          incrementMetric('transactions_created');

          const insSupplier = await client.query<{ id: string }>(
            `
            INSERT INTO bank_transactions (
              tenant_id, actor_id, account_id, amount_cents, purpose, justification,
              reference_type, reference_id, counterpart_account_id, reference_group_id, concept_id
            )
            VALUES ($1, $2, $3, $4, 'execution', $5, $6, $7, $8, $9, $10)
            RETURNING id
            `,
            [
              supplierTenantId,
              supplierActorIdRow,
              supplierBankAccountId,
              intentAmount,
              justification,
              B2B_PAYMENT_INTENT_REFERENCE_TYPE_CREDIT,
              refId,
              buyerBankAccountId,
              referenceGroupId,
              concept_id,
            ]
          );
          supplierTxId = insSupplier.rows[0]!.id;
          incrementMetric('transactions_created');
        } catch (e) {
          if (isUniqueViolation(e)) {
            await client.query('ROLLBACK');
            if (attempt < maxAttempts - 1) {
              continue;
            }
            throw new Error('B2B_PAYMENT_IDEMPOTENCY_RACE');
          }
          throw e;
        }

        const fromAfter = asMoneyCents(fromBal.balanceCents - intentAmount);
        const toAfter = asMoneyCents(toBal.balanceCents + intentAmount);

        await bankLedgerRepository.createEntry(
          buyerTenantId,
          {
            accountId: buyerBankAccountId,
            transactionId: buyerTxId,
            entryType: 'debit',
            amountCents: toPositiveMoneyCents(intentAmount),
            balanceBeforeCents: fromBal.balanceCents,
            balanceAfterCents: fromAfter,
            description: `B2B debit order ${b2bOrderId}`,
            authorship,
          },
          client
        );

        try {
          await bankLedgerRepository.createEntry(
            supplierTenantId,
            {
              accountId: supplierBankAccountId,
              transactionId: supplierTxId,
              entryType: 'credit',
              amountCents: toPositiveMoneyCents(intentAmount),
              balanceBeforeCents: toBal.balanceCents,
              balanceAfterCents: toAfter,
              description: `B2B credit order ${b2bOrderId}`,
              authorship,
            },
            client
          );
        } catch (e) {
          if (isCoverageExceeded(e)) {
            logFinancialEvent({
              financial_event: 'b2b_payment_coverage_exceeded',
              tenant_id: supplierTenantId,
              account_id: supplierBankAccountId,
              amount_cents: intentAmount,
              reference_id: refId,
            });
            await client.query('ROLLBACK');
            throw new Error('B2B_BANK_COVERAGE_EXCEEDED');
          }
          throw e;
        }

        await client.query(
          `UPDATE bank_transactions SET internal_completed_at = NOW() WHERE id IN ($1, $2)`,
          [buyerTxId, supplierTxId]
        );

        await client.query(
          `UPDATE b2b_payment_intents
           SET status = 'completed',
               bank_transaction_id = $2,
               bank_transaction_supplier_id = $3,
               updated_at = now()
           WHERE id = $1 AND status = 'ready'`,
          [intentId, buyerTxId, supplierTxId]
        );

        await insertEventOutboxRow(client, {
          tenantId: buyerTenantId,
          eventId: b2bPaymentCompletedEventId(intentId),
          eventType: 'b2b.payment.completed',
          payload: {
            order_id: b2bOrderId,
            intent_id: intentId,
            transaction_id: buyerTxId,
            transaction_supplier_id: supplierTxId,
            reference_group_id: referenceGroupId,
            amount_cents: intentAmount,
            currency: intent.currency,
          },
        });

        await client.query('COMMIT');

        logFinancialEvent({
          financial_event: 'b2b_payment_settled',
          tenant_id: buyerTenantId,
          reference_type: B2B_PAYMENT_INTENT_REFERENCE_TYPE_DEBIT,
          reference_id: refId,
          transaction_id: buyerTxId,
          amount_cents: intentAmount,
          metadata: { supplier_transaction_id: supplierTxId, reference_group_id: referenceGroupId },
        });

        return {
          intentId,
          orderId: b2bOrderId,
          transactionId: buyerTxId,
          supplierTransactionId: supplierTxId,
          amountCents: intentAmount,
          currency: intent.currency,
          idempotentReplay: false,
        };
      } catch (err) {
        try {
          await client.query('ROLLBACK');
        } catch {
          /* ignore */
        }
        throw err;
      }
    }

    throw new Error('B2B_PAYMENT_MAX_ATTEMPTS');
  } finally {
    client.release();
    await unlockAccount(buyerBankAccountId);
  }
}
