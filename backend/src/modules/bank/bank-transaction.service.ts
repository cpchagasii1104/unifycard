// backend/src/modules/bank/bank-transaction.service.ts
// SPRINT 2: TRANSACTIONS + SPLIT ENGINE
// Service para transações do Unify Bank

import { v4 as uuidv4 } from 'uuid';
import type { PoolClient } from 'pg';
import { getClientWithTenant, runQueryWithTenant, pool } from '@core/database/pool';
import { resolveFinancialConceptId as resolveConceptId } from '@modules/concept-resolution/concept-financial-resolver.service';
import { enqueueReconciliation } from '@core/events/payment-events-queue';
import { bankAccountRepository } from './bank-account.repository';
import { bankLedgerRepository } from './bank-ledger.repository';
import { bankSplitRepository } from './bank-split.repository';
import { bankSplitEngineService } from './bank-split-engine.service';
import { bankMetricsService } from '@core/observability/bank-metrics.service';
import { logFinancialEvent } from '@core/observability/financial-logger';
import { incrementMetric } from '@core/observability/financial-metrics';
import {
  detectFinancialAnomaly,
  recordTransactionForFragmentation,
} from '@core/observability/financial-anomaly-detector';
import {
  validateTransferLimit,
  validateDailyTransferLimit,
} from '@core/financial/transfer-limits';
import { lockAccount, unlockAccount } from '@core/financial/account-locks';
import { recordFinancialAudit } from '@core/observability/financial-audit';
// DECISION-0048: SplitPolicyMetadata removido (bank-policy.service não é
// mais fonte de policy de split). bankSplitEngineService.calculateSplits
// usa apenas context + defaults hardcoded até cutover PE-3+.
import type { FinancialAuthorshipContext } from './financial-authorship.types';
import { asMoneyCents, toPositiveMoneyCents } from '@contracts/marketplace/canonical';
import type {
  BankTransaction,
  CreateBankTransactionInput,
  BankTransferResult,
  BankTransactionType,
  TreasuryOperationSource,
} from './bank-transaction.types';
import { logTreasuryOperation } from '@core/observability/financial-logger';
import type { BankCurrency } from './bank-account.types';
import type {
  BankTransactionContext,
  BankSplit,
  BankSplitCalculation,
  BankSplitType,
} from './bank-split.types';

/** reference_type canônico por contexto de split (substitui o genérico "split"). */
function referenceTypeForSplitContext(context: BankTransactionContext): string {
  const map: Record<BankTransactionContext, string> = {
    service_booking: 'service_booking_payment',
    event_ticket: 'event_ticket_payment',
    p2p_transfer: 'p2p_transfer_payment',
    group_contribution: 'group_contribution_payment',
    ride_payment: 'ride_payment',
    deposit: 'deposit_payment',
    withdrawal: 'withdrawal_payment',
  };
  return map[context];
}

/** Row conforme tabela bank_transactions no Genesis 0003 */
interface BankTransactionRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  account_id: string;
  amount_cents: number;
  purpose: string;
  reference_type: string | null;
  reference_id: string | null;
  internal_completed_at: Date | null;
  created_at: Date;
}

const LIMIT_AMOUNT_CENTS = 100_000_000; // 100M centavos = 1M BRL (overflow guard)

function validateAmountCents(amountCents: number): void {
  if (amountCents > LIMIT_AMOUNT_CENTS) {
    throw new Error('AMOUNT_OVERFLOW');
  }
}

/** PostgreSQL unique_violation */
function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === '23505';
}

class BankTransactionService {
  /**
   * Pré-cheque institucional (ATL → KYC → GUARDA) antes de débito em conta não-system/escrow.
   * Mesma política que {@link transfer}; decisão centralizada em `authorityDecisionService`.
   */
  private async requireFinancialRiskClearanceForDebitSide(
    tenantId: string,
    fromAccount: { ownerType: string; actorId?: string | null },
    amountCents: number,
    action: 'financial_transfer' | 'financial_payment'
  ): Promise<void> {
    const ot = fromAccount.ownerType as string;
    if (ot === 'system' || ot === 'escrow') {
      return;
    }
    const debitActorId = fromAccount.actorId;
    if (!debitActorId) {
      throw new Error('RISK_DEBIT_ACTOR_UNRESOLVED');
    }
    const { requireFinancialRiskClearance } = await import('@modules/risk-identity/risk-financial-gate');
    await requireFinancialRiskClearance(tenantId, {
      actorId: debitActorId,
      action,
      amountCents,
    });
  }

  /**
   * Lock contas em ordem determinística (evita deadlock).
   */
  private async lockAccounts(client: PoolClient, tenantId: string, accountIds: string[]): Promise<void> {
    const ordered = [...new Set(accountIds)].filter(Boolean).sort();
    for (const id of ordered) {
      await client.query(
        `SELECT id FROM bank_accounts WHERE tenant_id = $1 AND id = $2 FOR UPDATE`,
        [tenantId, id]
      );
    }
  }

  /**
   * Contrapartida contábil para createSimpleTransaction quando só há origem ou só destino.
   * Mesmo owner_id usado em backfill-e2e-mint-ledger-debits (double-entry).
   */
  private async ensureLiquidityIssuanceAccountId(client: PoolClient, tenantId: string): Promise<string> {
    const ownerId = `system:liquidity_issuance:${tenantId}`;
    const ins = await client.query<{ id: string }>(
      `
      INSERT INTO bank_accounts (tenant_id, owner_id, owner_type, account_type)
      VALUES ($1, $2, 'system', 'credit')
      ON CONFLICT (tenant_id, owner_type, owner_id) DO NOTHING
      RETURNING id
      `,
      [tenantId, ownerId]
    );
    if (ins.rows[0]?.id) {
      return ins.rows[0].id;
    }
    const sel = await client.query<{ id: string }>(
      `
      SELECT id FROM bank_accounts
      WHERE tenant_id = $1 AND owner_type = 'system' AND owner_id = $2
      LIMIT 1
      `,
      [tenantId, ownerId]
    );
    if (!sel.rows[0]?.id) {
      throw new Error('BANK_LIQUIDITY_ISSUANCE_ACCOUNT');
    }
    return sel.rows[0].id;
  }

  /**
   * Converte row do banco (Genesis) para objeto BankTransaction.
   * fromAccountId/toAccountId vêm do ledger quando necessário (getTransactionById).
   */
  private toTransaction(row: BankTransactionRow, fromAccountId?: string | null, toAccountId?: string | null): BankTransaction {
    return {
      transactionId: row.id,
      tenantId: row.tenant_id,
      eventId: row.reference_id ?? '',
      fromAccountId: fromAccountId ?? row.account_id,
      toAccountId: toAccountId ?? null,
      amountCents: toPositiveMoneyCents(Number(row.amount_cents)),
      currency: 'BRL',
      transactionType: 'transfer',
      originalTransactionId: null,
      status: 'completed',
      description: null,
      metadata: null,
      createdAt: row.created_at.toISOString(),
      settledAt: row.internal_completed_at,
    };
  }

  /**
   * Executa transferência entre contas
   *
   * REGRAS ARQUITETURAIS:
   * - Transação SQL atômica
   * - Validação de saldo (calculado do ledger)
   * - Double-entry no ledger
   * - Idempotência via event_id
   * - Saldo é sempre calculado do ledger
   *
   * Fase 4.1 (concorrência débito):
   * Após idempotência, `lockAccounts` faz `SELECT … FOR UPDATE` nas linhas de `bank_accounts`
   * (origem e destino, ordem determinística). Duas transferências com a mesma conta de origem
   * serializam nesse lock; o saldo de débito é lido com o **mesmo** `PoolClient` da transação,
   * de modo que decisão e escrita no `bank_ledger` partilham a mesma visão temporal.
   */
  /**
   * Executa transferência entre contas.
   * @param existingClient - Quando informado, usa esta conexão (transação externa); não faz BEGIN/COMMIT/release.
   */
  async transfer(
    tenantId: string,
    input: CreateBankTransactionInput,
    existingClient?: PoolClient
  ): Promise<BankTransferResult> {
    let {
      eventId = uuidv4(),
      fromAccountId,
      toAccountId,
      amountCents,
      currency = 'BRL',
      description,
      metadata,
      referenceType,
      referenceId,
      orderId,
      concept_id,
      authorship,
    } = input;

    // Validações
    if (!fromAccountId || !toAccountId) {
      throw new Error('fromAccountId and toAccountId are required');
    }

    if (fromAccountId === toAccountId) {
      throw new Error('Cannot transfer to the same account');
    }

    if (amountCents <= 0) {
      throw new Error('Amount must be greater than zero');
    }

    // C66: aceita slug ou UUID (fail-closed em concept-resolver)
    concept_id = await resolveConceptId(input.concept_id);

    try {
      validateAmountCents(amountCents);
    } catch (e) {
      if (e instanceof Error && e.message === 'AMOUNT_OVERFLOW') {
        incrementMetric('overflow_attempt');
        logFinancialEvent({
          financial_event: 'transaction_amount_overflow',
          tenant_id: tenantId,
          account_id: fromAccountId,
          amount_cents: amountCents,
        });
      }
      throw e;
    }

    const refType = typeof referenceType === 'string' ? referenceType.trim() : '';
    const refId =
      referenceId != null && referenceId !== ''
        ? String(referenceId).trim()
        : '';
    if (!refType || !refId) {
      throw new Error('BANK_REFERENCE_REQUIRED');
    }

    const client = existingClient ?? (await getClientWithTenant(tenantId));
    const ownClient = !existingClient;
    let accountLocked = false;

    try {
      if (ownClient) {
        await client.query('BEGIN');
      }

      // Lock por referência: serializa concorrência para mesma (tenant_id, reference_type, reference_id)
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtext($1::text), hashtext(($2 || $3)::text))`,
        [tenantId, refType, refId]
      );

      // Idempotência: se já existe transação com essa referência, retornar (FOR UPDATE lock na linha)
      {
        const existingByRef = await client.query<BankTransactionRow>(
          `SELECT id, account_id FROM bank_transactions
           WHERE tenant_id = $1 AND reference_type = $2 AND reference_id = $3
           LIMIT 1 FOR UPDATE`,
          [tenantId, refType, refId]
        );
        if (existingByRef.rows.length > 0) {
          const row = existingByRef.rows[0];
          incrementMetric('idempotent_returns');
          logFinancialEvent({
            financial_event: 'transaction_idempotent_return',
            reference_type: refType,
            reference_id: refId,
            transaction_id: row.id,
            tenant_id: tenantId,
          });
          const entries = await bankLedgerRepository.getEntriesByTransaction(tenantId, row.id);
          const debitEntry = entries.find((e) => e.entryType === 'debit');
          const creditEntry = entries.find((e) => e.entryType === 'credit');
          if (!debitEntry || !creditEntry) {
            await client.query('ROLLBACK');
            throw new Error('Existing transfer missing debit or credit in ledger');
          }
          const fromId = debitEntry.accountId;
          const toId = creditEntry.accountId;
          const fromBal = await bankLedgerRepository.calculateBalance(tenantId, fromId, client);
          const toBal = await bankLedgerRepository.calculateBalance(tenantId, toId, client);
          if (ownClient) await client.query('COMMIT');
          if (ownClient && refType === 'payment_plan') {
            enqueueReconciliation({
              tenant_id: tenantId,
              reference_type: 'bank_transaction',
              reference_id: row.id,
            });
          }
          return {
            transactionId: row.id,
            fromAccountId: fromId,
            toAccountId: toId,
            amountCents,
            currency: currency as BankCurrency,
            fromBalanceCents: fromBal.balanceCents,
            toBalanceCents: toBal.balanceCents,
            ledgerEntries: { fromEntry: debitEntry.entryId, toEntry: creditEntry.entryId },
          };
        }
      }

      try {
        await lockAccount(fromAccountId);
        accountLocked = true;
      } catch (e) {
        if (e instanceof Error && e.message === 'ACCOUNT_LOCKED') {
          logFinancialEvent({
            financial_event: 'account_double_spend_blocked',
            account_id: fromAccountId,
            tenant_id: tenantId,
          });
        }
        await client.query('ROLLBACK');
        throw e;
      }

      const fromAccount = await bankAccountRepository.getAccountById(tenantId, fromAccountId);
      const toAccount = await bankAccountRepository.getAccountById(tenantId, toAccountId);

      if (!fromAccount) {
        await client.query('ROLLBACK');
        throw new Error(`From account ${fromAccountId} not found`);
      }

      if (!toAccount) {
        await client.query('ROLLBACK');
        throw new Error(`To account ${toAccountId} not found`);
      }

      if (fromAccount.currency !== currency || toAccount.currency !== currency) {
        await client.query('ROLLBACK');
        throw new Error('Currency mismatch');
      }

      const ot = fromAccount.ownerType as string;
      const skipRiskGate = ot === 'system' || ot === 'escrow';
      if (!skipRiskGate) {
        const debitActorId = fromAccount.actorId;
        if (!debitActorId) {
          await client.query('ROLLBACK');
          throw new Error('RISK_DEBIT_ACTOR_UNRESOLVED');
        }
        try {
          const { requireFinancialRiskClearance } = await import('@modules/risk-identity/risk-financial-gate');
          await requireFinancialRiskClearance(tenantId, {
            actorId: debitActorId,
            action: 'financial_transfer',
            amountCents,
          });
        } catch (riskErr) {
          await client.query('ROLLBACK');
          throw riskErr;
        }
      }

      // Treasury isolation (Prompt 50): contas system só podem ser usadas por fluxos autorizados
      const ALLOWED_TREASURY_SOURCES: TreasuryOperationSource[] = [
        'treasury:distribution',
        'treasury:governance',
        'treasury:settlement',
        'treasury:simulation',
        'treasury:reversal',
      ];
      if (fromAccount.ownerType === 'system') {
        const source = input.treasurySource;
        if (!source || !ALLOWED_TREASURY_SOURCES.includes(source)) {
          await client.query('ROLLBACK');
          logFinancialEvent({
            financial_event: 'treasury_access_violation',
            tenant_id: tenantId,
            account_id: fromAccountId,
            amount_cents: amountCents,
            metadata: { reason: 'missing_or_invalid_treasury_source', source: source ?? undefined },
          });
          throw new Error('TREASURY_ACCESS_VIOLATION');
        }
        if (source === 'treasury:simulation' && process.env.NODE_ENV === 'production') {
          await client.query('ROLLBACK');
          logFinancialEvent({
            financial_event: 'treasury_access_violation',
            tenant_id: tenantId,
            account_id: fromAccountId,
            amount_cents: amountCents,
            metadata: { reason: 'treasury_simulation_forbidden_in_production', source },
          });
          throw new Error('TREASURY_SIMULATION_FORBIDDEN_IN_PRODUCTION');
        }
        if (source === 'treasury:distribution' || source === 'treasury:governance') {
          if (toAccount.ownerType !== 'system') {
            await client.query('ROLLBACK');
            logFinancialEvent({
              financial_event: 'treasury_access_violation',
              tenant_id: tenantId,
              account_id: toAccountId,
              amount_cents: amountCents,
              metadata: { reason: 'treasury_to_user_or_company_blocked', source },
            });
            throw new Error('TREASURY_ACCESS_VIOLATION');
          }
        }
        logTreasuryOperation({
          tenant_id: tenantId,
          source,
          destination: toAccountId,
          amount_cents: amountCents,
          operation_type: 'transfer',
          timestamp: new Date().toISOString(),
        });
      }

      await this.lockAccounts(client, tenantId, [fromAccountId, toAccountId]);

      const fromBalance = await bankLedgerRepository.calculateBalance(tenantId, fromAccountId, client);
      const toBalance = await bankLedgerRepository.calculateBalance(tenantId, toAccountId, client);

      if (fromBalance.balanceCents < amountCents) {
        incrementMetric('insufficient_funds_attempt');
        logFinancialEvent({
          financial_event: 'transaction_insufficient_funds',
          tenant_id: tenantId,
          account_id: fromAccountId,
          amount_cents: amountCents,
        });
        await client.query('ROLLBACK');
        throw new Error('INSUFFICIENT_FUNDS');
      }

      // Genesis: actor_id NOT NULL. Usar UUID de authorship ou da conta; se inválido (ex: 'system'), buscar um actor do tenant.
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      let actorId: string =
        authorship?.actingForActorId ?? fromAccount.actorId ?? fromAccountId;
      if (!uuidRegex.test(actorId)) {
        actorId = fromAccount.actorId ?? '';
      }
      if (!actorId || !uuidRegex.test(actorId)) {
        const res = await client.query<{ id: string }>(
          'SELECT id FROM actors WHERE tenant_id = $1 LIMIT 1',
          [tenantId]
        );
        actorId = res.rows[0]?.id ?? '';
      }
      if (!actorId || !uuidRegex.test(actorId)) {
        await client.query('ROLLBACK');
        throw new Error(
          'Cannot resolve actor_id for transaction: tenant has no actors and account has no actor_id'
        );
      }
      const justification =
        description && description.trim().length >= 10
          ? description.trim()
          : 'Transfer between accounts';

      try {
        validateTransferLimit(amountCents);
        validateDailyTransferLimit(tenantId, actorId, amountCents);
      } catch (e) {
        if (
          e instanceof Error &&
          (e.message === 'TRANSFER_LIMIT_EXCEEDED' || e.message === 'DAILY_TRANSFER_LIMIT_EXCEEDED')
        ) {
          logFinancialEvent({
            financial_event: 'transfer_limit_exceeded',
            tenant_id: tenantId,
            actor_id: actorId,
            amount_cents: amountCents,
          });
        }
        throw e;
      }

      logFinancialEvent({
        financial_event: 'transaction_attempt',
        tenant_id: tenantId,
        reference_type: refType,
        reference_id: refId,
        amount_cents: amountCents,
        actor_id: actorId,
      });

      function isCounterpartColumnMissing(err: unknown): boolean {
        const c = (err as { code?: string; message?: string })?.code;
        const m = String((err as Error)?.message || '');
        return c === '42703' || m.includes('counterpart_account_id');
      }

      let row: BankTransactionRow;
      let transactionId: string;
      try {
        let transactionResult: import('pg').QueryResult<BankTransactionRow>;
        // C56: order_id propagado para rastreabilidade de receita marketplace
        try {
          transactionResult = await client.query<BankTransactionRow>(
            `
        INSERT INTO bank_transactions (
          tenant_id, actor_id, account_id, amount_cents, purpose, justification, reference_type, reference_id, counterpart_account_id, order_id, concept_id
        )
        VALUES ($1, $2, $3, $4, 'execution', $5, $6, $7, $8, $9, $10)
        RETURNING id, tenant_id, actor_id, account_id, amount_cents, purpose, reference_type, reference_id, internal_completed_at, created_at
        `,
            [tenantId, actorId, fromAccountId, amountCents, justification, refType, refId, toAccountId, orderId ?? null, concept_id]
          );
        } catch (inner: unknown) {
          if (!isCounterpartColumnMissing(inner)) throw inner;
          transactionResult = await client.query<BankTransactionRow>(
            `
        INSERT INTO bank_transactions (
          tenant_id, actor_id, account_id, amount_cents, purpose, justification, reference_type, reference_id, order_id, concept_id
        )
        VALUES ($1, $2, $3, $4, 'execution', $5, $6, $7, $8, $9)
        RETURNING id, tenant_id, actor_id, account_id, amount_cents, purpose, reference_type, reference_id, internal_completed_at, created_at
        `,
            [tenantId, actorId, fromAccountId, amountCents, justification, refType, refId, orderId ?? null, concept_id]
          );
        }
        row = transactionResult.rows[0];
        transactionId = row.id;
        incrementMetric('transactions_created');
        logFinancialEvent({
          financial_event: 'transaction_created',
          transaction_id: transactionId,
          tenant_id: tenantId,
          account_id: row.account_id,
          amount_cents: row.amount_cents,
        });
        detectFinancialAnomaly({
          type: 'high_frequency_transactions',
          tenant_id: tenantId,
          actor_id: actorId,
          account_id: fromAccountId,
          amount_cents: amountCents,
        });
        recordTransactionForFragmentation(tenantId, actorId, fromAccountId, amountCents);
        try {
          await recordFinancialAudit(pool, {
            event_type: 'transaction_created',
            tenant_id: tenantId,
            transaction_id: transactionId,
            account_id: fromAccountId,
            actor_id: actorId,
            amount_cents: amountCents,
          });
        } catch (_auditErr) {
          // Best-effort: não falha a transação se a trilha de auditoria falhar (ex.: tabela ainda não criada)
        }
      } catch (insertErr: unknown) {
        if (isUniqueViolation(insertErr)) {
          incrementMetric('duplicate_reference_attempt');
          await client.query('ROLLBACK');
          for (let retry = 0; retry < 20; retry++) {
            const existingByRef = await client.query<BankTransactionRow>(
              `SELECT id, account_id FROM bank_transactions
               WHERE tenant_id = $1 AND reference_type = $2 AND reference_id = $3 LIMIT 1`,
              [tenantId, refType, refId]
            );
            if (existingByRef.rows.length > 0) {
              const existingRow = existingByRef.rows[0];
              incrementMetric('idempotent_returns');
              logFinancialEvent({
                financial_event: 'transaction_idempotent_return',
                reference_type: refType,
                reference_id: refId,
                transaction_id: existingRow.id,
                tenant_id: tenantId,
              });
              const entries = await bankLedgerRepository.getEntriesByTransaction(tenantId, existingRow.id);
              const debitEntry = entries.find((e) => e.entryType === 'debit');
              const creditEntry = entries.find((e) => e.entryType === 'credit');
              if (debitEntry && creditEntry) {
                const fromId = debitEntry.accountId;
                const toId = creditEntry.accountId;
                const fromBal = await bankLedgerRepository.calculateBalance(tenantId, fromId, client);
                const toBal = await bankLedgerRepository.calculateBalance(tenantId, toId, client);
                if (ownClient && refType === 'payment_plan') {
                  enqueueReconciliation({
                    tenant_id: tenantId,
                    reference_type: 'bank_transaction',
                    reference_id: existingRow.id,
                  });
                }
                return {
                  transactionId: existingRow.id,
                  fromAccountId: fromId,
                  toAccountId: toId,
                  amountCents,
                  currency: currency as BankCurrency,
                  fromBalanceCents: fromBal.balanceCents,
                  toBalanceCents: toBal.balanceCents,
                  ledgerEntries: { fromEntry: debitEntry.entryId, toEntry: creditEntry.entryId },
                };
              }
            }
            await new Promise((r) => setTimeout(r, 100 * (retry + 1)));
          }
        }
        throw insertErr;
      }

      const transaction = this.toTransaction(row, fromAccountId, toAccountId);

      // Calcular novos saldos
      const fromBalanceAfter = asMoneyCents(fromBalance.balanceCents - amountCents);
      const toBalanceAfter = asMoneyCents(toBalance.balanceCents + amountCents);

      // Criar entradas no ledger (double-entry) — Genesis: direction, amount_cents
      const fromEntry = await bankLedgerRepository.createEntry(tenantId, {
        accountId: fromAccountId,
        transactionId,
        entryType: 'debit',
        amountCents: toPositiveMoneyCents(amountCents),
        balanceBeforeCents: fromBalance.balanceCents,
        balanceAfterCents: fromBalanceAfter,
        description: description || `Transfer to ${toAccountId}`,
        metadata,
        authorship,
      }, client);

      const toEntry = await bankLedgerRepository.createEntry(tenantId, {
        accountId: toAccountId,
        transactionId,
        entryType: 'credit',
        amountCents: toPositiveMoneyCents(amountCents),
        balanceBeforeCents: toBalance.balanceCents,
        balanceAfterCents: toBalanceAfter,
        description: description || `Transfer from ${fromAccountId}`,
        metadata,
        authorship,
      }, client);

      // DECISION-0024: cache update hook é NO-OP Genesis; chamadas removidas.

      await client.query(
        `UPDATE bank_transactions SET internal_completed_at = NOW() WHERE id = $1`,
        [transactionId]
      );

      if (ownClient) {
        await client.query('COMMIT');
      }

      logFinancialEvent({
        financial_event: 'transfer_completed',
        tenant_id: tenantId,
        transaction_id: transactionId,
        reference_type: refType,
        reference_id: refId,
        amount_cents: amountCents,
        metadata: {
          from_account_id: fromAccountId,
          to_account_id: toAccountId,
        },
      });

      if (ownClient && refType === 'payment_plan') {
        enqueueReconciliation({
          tenant_id: tenantId,
          reference_type: 'bank_transaction',
          reference_id: transactionId,
        });
      }

      return {
        transactionId,
        fromAccountId,
        toAccountId,
        amountCents,
        currency,
        fromBalanceCents: fromBalanceAfter,
        toBalanceCents: toBalanceAfter,
        ledgerEntries: {
          fromEntry: fromEntry.entryId,
          toEntry: toEntry.entryId,
        },
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      if (accountLocked) {
        await unlockAccount(fromAccountId);
      }
      if (ownClient) {
        client.release();
      }
    }
  }

  /**
   * Busca transação por ID (Genesis: id). from/to derivados do ledger.
   */
  async getTransactionById(
    tenantId: string,
    transactionId: string
  ): Promise<BankTransaction | null> {
    const client = await getClientWithTenant(tenantId);

    try {
      const result = await client.query<BankTransactionRow>(
        `
        SELECT id, tenant_id, actor_id, account_id, amount_cents, purpose, reference_type, reference_id, internal_completed_at, created_at
        FROM bank_transactions
        WHERE id = $1
        LIMIT 1
        `,
        [transactionId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const entries = await bankLedgerRepository.getEntriesByTransaction(tenantId, transactionId);
      const fromId = entries.find((e) => e.entryType === 'debit')?.accountId ?? null;
      const toId = entries.find((e) => e.entryType === 'credit')?.accountId ?? null;
      return this.toTransaction(row, fromId, toId);
    } finally {
      client.release();
    }
  }

  /**
   * Lock determinístico de contas na mesma transação SQL (ex.: motor de reversão fora do pacote Bank).
   */
  async lockBankAccountsOrdered(
    client: PoolClient,
    tenantId: string,
    accountIds: string[]
  ): Promise<void> {
    await this.lockAccounts(client, tenantId, accountIds);
  }

  /**
   * Linha em SSOT de transações com bloqueio — usada apenas pelo motor de reversão.
   */
  async getTransactionLockedForReversal(
    client: PoolClient,
    tenantId: string,
    transactionId: string
  ): Promise<{
    account_id: string;
    amount_cents: number;
    internal_completed_at: Date | null;
    reference_type: string | null;
    counterpart_account_id: string | null;
  } | null> {
    function isMissingCounterpartColumn(err: unknown): boolean {
      const c = (err as { code?: string; message?: string })?.code;
      const m = String((err as Error)?.message || '');
      return c === '42703' || m.includes('counterpart_account_id');
    }

    try {
      const r = await client.query<{
        account_id: string;
        amount_cents: string;
        internal_completed_at: Date | null;
        reference_type: string | null;
        counterpart_account_id: string | null;
      }>(
        `SELECT account_id, amount_cents::text, internal_completed_at, reference_type,
                counterpart_account_id
         FROM bank_transactions
         WHERE tenant_id = $1 AND id = $2
         FOR UPDATE`,
        [tenantId, transactionId]
      );
      if (r.rows.length === 0) return null;
      const row = r.rows[0];
      return {
        account_id: row.account_id,
        amount_cents: Number(row.amount_cents),
        internal_completed_at: row.internal_completed_at,
        reference_type: row.reference_type,
        counterpart_account_id: row.counterpart_account_id ?? null,
      };
    } catch (e) {
      if (!isMissingCounterpartColumn(e)) throw e;
      const r = await client.query<{
        account_id: string;
        amount_cents: string;
        internal_completed_at: Date | null;
        reference_type: string | null;
      }>(
        `SELECT account_id, amount_cents::text, internal_completed_at, reference_type
         FROM bank_transactions
         WHERE tenant_id = $1 AND id = $2
         FOR UPDATE`,
        [tenantId, transactionId]
      );
      if (r.rows.length === 0) return null;
      const row = r.rows[0];
      return {
        account_id: row.account_id,
        amount_cents: Number(row.amount_cents),
        internal_completed_at: row.internal_completed_at,
        reference_type: row.reference_type,
        counterpart_account_id: null,
      };
    }
  }

  /**
   * Cria transação simples (sem splits)
   *
   * REGRAS ARQUITETURAIS:
   * - Transação SQL atômica
   * - Validação de saldo (calculado do ledger)
   * - Double-entry no ledger: sempre um débito e um crédito na mesma transação SQL.
   *   Se só `toAccountId` for informado (ex.: mint), a origem é `system:liquidity_issuance:{tenantId}`.
   *   Se só `fromAccountId` for informado, o destino é essa mesma conta de contrapartida.
   * - Idempotência via event_id
   */
  async createSimpleTransaction(
    tenantId: string,
    input: {
      /** Idempotência: deve ser único por (tenant_id, reference_type, reference_id). */
      eventId: string;
      /** Tipo canônico (ex.: event_payment_release, donation_transfer). */
      referenceType: string;
      fromAccountId?: string;
      toAccountId?: string;
      amountCents: number;
      currency?: BankCurrency;
      transactionType: BankTransactionType;
      description?: string;
      metadata?: Record<string, any>;
      /**
       * Contexto de autoria (OBRIGATÓRIO - REGRA INQUEBRÁVEL)
       * Hard fail no código se não fornecido
       */
      authorship: FinancialAuthorshipContext;
      /** C2: FK para concepts(concept_id) — SSOT semântico da operação financeira. */
      concept_id: string;
    }
  ): Promise<{
    transaction: BankTransaction;
    ledgerEntries: Array<{ entryId: string; accountId: string; entryType: 'credit' | 'debit' }>;
  }> {
    let {
      eventId,
      referenceType,
      fromAccountId,
      toAccountId,
      amountCents,
      currency = 'BRL',
      transactionType,
      description,
      metadata,
      authorship,
    } = input;

    if (amountCents <= 0) {
      throw new Error('Amount must be greater than zero');
    }
    validateAmountCents(amountCents);

    const refT = typeof referenceType === 'string' ? referenceType.trim() : '';
    if (!refT) {
      throw new Error('BANK_REFERENCE_REQUIRED');
    }

    // 🔴 HARD FAIL: Autoria obrigatória (REGRA INQUEBRÁVEL)
    if (!authorship) {
      throw new Error('Financial authorship is mandatory. Missing authorship context.');
    }

    return this.createSimpleTransactionWithAuthorship(tenantId, input);
  }

  /**
   * Cria transação simples com autoria (método interno)
   */
  private async createSimpleTransactionWithAuthorship(
    tenantId: string,
    input: {
      eventId: string;
      referenceType: string;
      fromAccountId?: string;
      toAccountId?: string;
      amountCents: number;
      currency?: BankCurrency;
      transactionType: BankTransactionType;
      description?: string;
      metadata?: Record<string, any>;
      concept_id: string;
      authorship: FinancialAuthorshipContext; // Agora obrigatório
    }
  ): Promise<{
    transaction: BankTransaction;
    ledgerEntries: Array<{ entryId: string; accountId: string; entryType: 'credit' | 'debit' }>;
  }> {
    let {
      eventId,
      referenceType,
      fromAccountId,
      toAccountId,
      amountCents,
      currency = 'BRL',
      transactionType,
      description,
      metadata,
      concept_id,
      authorship,
    } = input;

    const refT = referenceType.trim();
    const refId = String(eventId).trim();
    if (!refT || !refId) {
      throw new Error('BANK_REFERENCE_REQUIRED');
    }

    // C66: aceita slug ou UUID (fail-closed em concept-resolver)
    concept_id = await resolveConceptId(input.concept_id);

    const client = await getClientWithTenant(tenantId);

    try {
      await client.query('BEGIN');

      const existingByRef = await client.query<BankTransactionRow>(
        `SELECT id FROM bank_transactions WHERE tenant_id = $1 AND reference_type = $2 AND reference_id = $3 LIMIT 1`,
        [tenantId, refT, refId]
      );
      if (existingByRef.rows.length > 0) {
        await client.query('ROLLBACK');
        throw new Error(`Transaction with event_id ${eventId} already exists`);
      }

      if (fromAccountId) {
        const fromAccount = await bankAccountRepository.getAccountById(tenantId, fromAccountId);
        if (!fromAccount) {
          await client.query('ROLLBACK');
          throw new Error(`From account ${fromAccountId} not found`);
        }
        if (fromAccount.currency !== currency) {
          await client.query('ROLLBACK');
          throw new Error('Currency mismatch in from account');
        }
      }

      if (toAccountId) {
        const toAccount = await bankAccountRepository.getAccountById(tenantId, toAccountId);
        if (!toAccount) {
          await client.query('ROLLBACK');
          throw new Error(`To account ${toAccountId} not found`);
        }
        if (toAccount.currency !== currency) {
          await client.query('ROLLBACK');
          throw new Error('Currency mismatch in to account');
        }
      }

      let effectiveFrom: string;
      let effectiveTo: string;

      if (fromAccountId && toAccountId) {
        effectiveFrom = fromAccountId;
        effectiveTo = toAccountId;
      } else if (fromAccountId && !toAccountId) {
        effectiveFrom = fromAccountId;
        effectiveTo = await this.ensureLiquidityIssuanceAccountId(client, tenantId);
      } else if (!fromAccountId && toAccountId) {
        effectiveFrom = await this.ensureLiquidityIssuanceAccountId(client, tenantId);
        effectiveTo = toAccountId;
      } else {
        await client.query('ROLLBACK');
        throw new Error('BANK_SIMPLE_TX_REQUIRES_FROM_OR_TO_ACCOUNT');
      }

      await this.lockAccounts(client, tenantId, [effectiveFrom, effectiveTo]);

      const debitAccRowResult = await client.query<{
        id: string; owner_type: string; owner_id: string; account_type: string; actor_id: string | null;
      }>(
        `SELECT id, owner_type, owner_id, account_type, actor_id
         FROM bank_accounts
         WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
        [tenantId, effectiveFrom]
      );
      if (!debitAccRowResult.rows[0]) {
        await client.query('ROLLBACK');
        throw new Error(`From account ${effectiveFrom} not found`);
      }
      const debitAccRow = {
        accountId: debitAccRowResult.rows[0].id,
        ownerType: debitAccRowResult.rows[0].owner_type,
        ownerId: debitAccRowResult.rows[0].owner_id,
        accountType: debitAccRowResult.rows[0].account_type,
        actorId: debitAccRowResult.rows[0].actor_id,
        currency: 'BRL' as const,
        tenantId,
        cachedBalanceCents: 0 as any,
        metadata: null,
        createdAt: '',
        updatedAt: '',
      };
      try {
        await this.requireFinancialRiskClearanceForDebitSide(
          tenantId,
          debitAccRow,
          amountCents,
          'financial_transfer'
        );
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }

      const actorId = authorship.actingForActorId ?? fromAccountId ?? toAccountId ?? '';
      const accountIdForRow = fromAccountId ?? toAccountId ?? '';

      const justificationSimple =
        description && description.trim().length >= 10 ? description.trim() : 'Simple transaction execution';
      const transactionResult = await client.query<BankTransactionRow>(
        `
        INSERT INTO bank_transactions (
          tenant_id, actor_id, account_id, amount_cents, purpose, justification, reference_type, reference_id, concept_id
        )
        VALUES ($1, $2, $3, $4, 'execution', $5, $6, $7, $8)
        RETURNING id, tenant_id, actor_id, account_id, amount_cents, purpose, reference_type, reference_id, internal_completed_at, created_at
        `,
        [tenantId, actorId, accountIdForRow, amountCents, justificationSimple, refT, refId, concept_id]
      );

      const txId = transactionResult.rows[0].id;
      const transaction = this.toTransaction(transactionResult.rows[0], fromAccountId || null, toAccountId || null);
      const ledgerEntries: Array<{ entryId: string; accountId: string; entryType: 'credit' | 'debit' }> = [];

      const fromBalance = await bankLedgerRepository.calculateBalance(tenantId, effectiveFrom, client);
      const fromBalanceAfter = asMoneyCents(fromBalance.balanceCents - amountCents);

      const fromEntry = await bankLedgerRepository.createEntry(
        tenantId,
        {
          accountId: effectiveFrom,
          transactionId: txId,
          entryType: 'debit',
          amountCents: toPositiveMoneyCents(amountCents),
          balanceBeforeCents: fromBalance.balanceCents,
          balanceAfterCents: fromBalanceAfter,
          description: description || `Transaction ${transactionType}`,
          metadata,
          authorship,
        },
        client
      );

      ledgerEntries.push({ entryId: fromEntry.entryId, accountId: effectiveFrom, entryType: 'debit' });

      const toBalance = await bankLedgerRepository.calculateBalance(tenantId, effectiveTo, client);
      const toBalanceAfter = asMoneyCents(toBalance.balanceCents + amountCents);

      const toEntry = await bankLedgerRepository.createEntry(
        tenantId,
        {
          accountId: effectiveTo,
          transactionId: txId,
          entryType: 'credit',
          amountCents: toPositiveMoneyCents(amountCents),
          balanceBeforeCents: toBalance.balanceCents,
          balanceAfterCents: toBalanceAfter,
          description: description || `Transaction ${transactionType}`,
          metadata,
          authorship,
        },
        client
      );

      ledgerEntries.push({ entryId: toEntry.entryId, accountId: effectiveTo, entryType: 'credit' });

      await client.query(
        `UPDATE bank_transactions SET internal_completed_at = NOW() WHERE id = $1`,
        [txId]
      );

      await client.query('COMMIT');

      return {
        transaction,
        ledgerEntries,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Cria transação com splits automáticos
   * 
   * REGRAS ARQUITETURAIS:
   * - Calcula splits baseado no contexto
   * - Cria entradas no ledger para cada split
   * - Persiste splits na tabela bank_splits
   * - Valida invariantes (soma de splits = total)
   */
  async createTransactionWithSplit(
    tenantId: string,
    input: {
      eventId: string;
      fromAccountId: string;
      amountCents: number;
      currency?: BankCurrency;
      context: BankTransactionContext;
      revenueShareAccountId?: string; // Para organizer, worker, etc
      fromUserId?: string; // Para calcular referral e group allocation
      description?: string;
      metadata?: Record<string, any>;
      /**
       * Contexto de autoria (OBRIGATÓRIO - REGRA INQUEBRÁVEL)
       * Hard fail no código se não fornecido
       */
      authorship: FinancialAuthorshipContext;
      /** C2: FK para concepts(concept_id) — SSOT semântico. */
      concept_id: string;
    }
  ): Promise<{
    transaction: BankTransaction;
    splits: BankSplit[];
    ledgerEntries: Array<{ entryId: string; accountId: string; entryType: 'credit' | 'debit' }>;
  }> {
    let {
      eventId,
      fromAccountId,
      amountCents,
      currency = 'BRL',
      context,
      revenueShareAccountId,
      fromUserId,
      description,
      metadata,
      authorship,
    } = input;

    if (amountCents <= 0) {
      throw new Error('Amount must be greater than zero');
    }
    validateAmountCents(amountCents);

    // 🔴 HARD FAIL: Autoria obrigatória (REGRA INQUEBRÁVEL)
    if (!authorship) {
      throw new Error('Financial authorship is mandatory. Missing authorship context.');
    }

    return this.createTransactionWithSplitAndAuthorship(tenantId, input);
  }

  /**
   * Cria transação com split e autoria (método interno)
   */
  private async createTransactionWithSplitAndAuthorship(
    tenantId: string,
    input: {
      eventId: string;
      fromAccountId: string;
      amountCents: number;
      currency?: BankCurrency;
      context: BankTransactionContext;
      revenueShareAccountId?: string;
      fromUserId?: string;
      description?: string;
      metadata?: Record<string, any>;
      concept_id: string;
      authorship: FinancialAuthorshipContext; // Agora obrigatório
    }
  ): Promise<{
    transaction: BankTransaction;
    splits: BankSplit[];
    ledgerEntries: Array<{ entryId: string; accountId: string; entryType: 'credit' | 'debit' }>;
  }> {
    let {
      eventId,
      fromAccountId,
      amountCents,
      currency = 'BRL',
      context,
      revenueShareAccountId,
      fromUserId,
      description,
      metadata,
      concept_id,
      authorship,
    } = input;

    // C66: aceita slug ou UUID (fail-closed em concept-resolver)
    concept_id = await resolveConceptId(input.concept_id);

    const client = await getClientWithTenant(tenantId);

    try {
      await client.query('BEGIN');

      const splitRefType = referenceTypeForSplitContext(context);
      const splitRefId = String(eventId).trim();
      if (!splitRefId) {
        throw new Error('BANK_REFERENCE_REQUIRED');
      }

      const existingByRef = await client.query<BankTransactionRow>(
        `SELECT id FROM bank_transactions WHERE tenant_id = $1 AND reference_type = $2 AND reference_id = $3 LIMIT 1`,
        [tenantId, splitRefType, splitRefId]
      );
      if (existingByRef.rows.length > 0) {
        await client.query('ROLLBACK');
        throw new Error(`Transaction with event_id ${eventId} already exists`);
      }

      const fromAccount = await bankAccountRepository.getAccountById(tenantId, fromAccountId);
      if (!fromAccount) {
        await client.query('ROLLBACK');
        throw new Error(`From account ${fromAccountId} not found`);
      }
      if (fromAccount.currency !== currency) {
        await client.query('ROLLBACK');
        throw new Error('Currency mismatch');
      }

      try {
        await this.requireFinancialRiskClearanceForDebitSide(
          tenantId,
          fromAccount,
          amountCents,
          'financial_transfer'
        );
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }

      // DECISION-0048: metadata da transação não é mais propagada a
      // bankSplitEngineService (resolveSplitPolicy removido). Policy
      // varia por contexto via defaults hardcoded. Fluxos com policy
      // por cityId/cnpj/canal usam economic_policy_engine direto e
      // createTransactionWithExplicitSplitLines.
      const splitCalculation = await bankSplitEngineService.calculateSplits(
        tenantId,
        context,
        amountCents,
        currency,
        revenueShareAccountId,
        fromUserId
      );

      if (!bankSplitEngineService.validateSplitCalculation(splitCalculation)) {
        await client.query('ROLLBACK');
        bankMetricsService.incrementValidationFailure();
        throw new Error('Split calculation validation failed');
      }

      bankMetricsService.incrementTransaction(context);

      const splitAccountIds = splitCalculation.splits.map((s) => s.targetAccountId);
      await this.lockAccounts(client, tenantId, [fromAccountId, ...splitAccountIds]);

      const actorId = authorship.actingForActorId ?? fromAccountId;
      const justificationSplit =
        description && description.trim().length >= 10 ? description.trim() : 'Split transaction execution';
      const transactionResult = await client.query<BankTransactionRow>(
        `
        INSERT INTO bank_transactions (
          tenant_id, actor_id, account_id, amount_cents, purpose, justification, reference_type, reference_id, concept_id
        )
        VALUES ($1, $2, $3, $4, 'execution', $5, $6, $7, $8)
        RETURNING id, tenant_id, actor_id, account_id, amount_cents, purpose, reference_type, reference_id, internal_completed_at, created_at
        `,
        [tenantId, actorId, fromAccountId, amountCents, justificationSplit, splitRefType, splitRefId, concept_id]
      );

      const txId = transactionResult.rows[0].id;
      const transaction = this.toTransaction(transactionResult.rows[0], fromAccountId, null);
      const splits: BankSplit[] = [];
      const ledgerEntries: Array<{ entryId: string; accountId: string; entryType: 'credit' | 'debit' }> = [];

      // Criar débito na conta de origem (com autoria) — mesmo client = mesma transação SQL
      const fromBalance = await bankLedgerRepository.calculateBalance(tenantId, fromAccountId, client);
      if (fromBalance.balanceCents < amountCents) {
        incrementMetric('insufficient_funds_attempt');
        logFinancialEvent({
          financial_event: 'transaction_insufficient_funds',
          tenant_id: tenantId,
          account_id: fromAccountId,
          amount_cents: amountCents,
        });
        throw new Error('INSUFFICIENT_FUNDS');
      }
      const fromBalanceAfter = asMoneyCents(fromBalance.balanceCents - amountCents);
      const fromEntry = await bankLedgerRepository.createEntry(tenantId, {
        accountId: fromAccountId,
        transactionId: txId,
        entryType: 'debit',
        amountCents: toPositiveMoneyCents(amountCents),
        balanceBeforeCents: fromBalance.balanceCents,
        balanceAfterCents: fromBalanceAfter,
        description: description || `Transaction with split: ${context}`,
        metadata,
        authorship,
      }, client);

      ledgerEntries.push({ entryId: fromEntry.entryId, accountId: fromAccountId, entryType: 'debit' });

      for (const splitCalc of splitCalculation.splits) {
        const targetBalance = await bankLedgerRepository.calculateBalance(
          tenantId,
          splitCalc.targetAccountId,
          client
        );
        const targetBalanceAfter = asMoneyCents(targetBalance.balanceCents + splitCalc.amountCents);

        const creditEntry = await bankLedgerRepository.createEntry(tenantId, {
          accountId: splitCalc.targetAccountId,
          transactionId: txId,
          entryType: 'credit',
          amountCents: toPositiveMoneyCents(splitCalc.amountCents),
          balanceBeforeCents: targetBalance.balanceCents,
          balanceAfterCents: targetBalanceAfter,
          description: description || `Split: ${splitCalc.splitType}`,
          metadata: { ...metadata, splitType: splitCalc.splitType },
          authorship,
        }, client);

        ledgerEntries.push({ entryId: creditEntry.entryId, accountId: splitCalc.targetAccountId, entryType: 'credit' });

        const split = await bankSplitRepository.createSplit(tenantId, {
          transactionId: txId,
          targetAccountId: splitCalc.targetAccountId,
          amountCents: splitCalc.amountCents,
          percentage: splitCalc.percentage,
          splitType: splitCalc.splitType,
          description: description || `Split: ${splitCalc.splitType}`,
          metadata: { 
            ...metadata, 
            splitType: splitCalc.splitType,
            ...(splitCalc.metadata || {}), // Incluir metadata do split engine (ex: groupId)
          },
          authorship, // Passar autoria para split
        }, client);

        splits.push(split);
      }

      const validation = await bankSplitRepository.validateSplitsSum(tenantId, txId, amountCents, client);
      if (!validation.isValid) {
        await client.query('ROLLBACK');
        throw new Error(
          `Split validation failed. transactionAmountCents: ${amountCents}, splitsSumCents: ${validation.splitsSumCents}, differenceCents: ${validation.differenceCents}`
        );
      }

      await client.query(
        `UPDATE bank_transactions SET internal_completed_at = NOW() WHERE id = $1`,
        [txId]
      );

      await client.query('COMMIT');

      return {
        transaction,
        splits,
        ledgerEntries,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Transação bank + bank_splits com linhas explícitas (ex.: execução de pagamento de serviço).
   * Idempotente: reference_type + reference_id únicos por execução.
   * Invariante: soma(splitLines.amountCents) === amountCents.
   */
  async createTransactionWithExplicitSplitLines(
    tenantId: string,
    input: {
      referenceType: string;
      referenceId: string;
      fromAccountId: string;
      payerActorId: string;
      amountCents: number;
      currency?: BankCurrency;
      splitLines: Array<{
        targetAccountId: string;
        amountCents: number;
        percentage?: number | null;
        receiverActorId: string;
        splitType?: BankSplitType;
      }>;
      description: string;
      metadata?: Record<string, any>;
      concept_id: string;
      authorship: FinancialAuthorshipContext;
    },
    /**
     * OUTBOX_ATOMICITY_HARDENING (Opção A): aceita client externo já com
     * BEGIN aberto. Quando informado, NÃO faz BEGIN/COMMIT/release — o caller
     * controla o ciclo de vida e o COMMIT acontece junto com as outras
     * escritas da mesma transação (execution row + outbox).
     * Pattern replicado de `transfer` L262-269 (mesmo arquivo).
     */
    existingClient?: PoolClient
  ): Promise<{
    transaction: BankTransaction;
    splits: BankSplit[];
    ledgerEntries: Array<{ entryId: string; accountId: string; entryType: 'credit' | 'debit' }>;
  }> {
    let {
      referenceType,
      referenceId,
      fromAccountId,
      payerActorId,
      amountCents,
      currency = 'BRL',
      splitLines,
      description,
      metadata = {},
      concept_id,
      authorship,
    } = input;

    if (amountCents <= 0 || splitLines.length === 0) {
      throw new Error('amountCents and splitLines required');
    }
    const sumSplits = splitLines.reduce((s, l) => s + l.amountCents, 0);
    if (sumSplits !== amountCents) {
      throw new Error(
        `Split sum ${sumSplits} must equal transaction amountCents ${amountCents}`
      );
    }

    // C66: aceita slug ou UUID (fail-closed em concept-resolver)
    concept_id = await resolveConceptId(input.concept_id);

    const client = existingClient ?? (await getClientWithTenant(tenantId));
    const ownClient = !existingClient;
    try {
      if (ownClient) {
        await client.query('BEGIN');
      }

      const dup = await client.query<{ id: string }>(
        `SELECT id FROM bank_transactions WHERE tenant_id = $1 AND reference_type = $2 AND reference_id = $3 LIMIT 1`,
        [tenantId, referenceType, referenceId]
      );
      if (dup.rows.length > 0) {
        const txId = dup.rows[0].id;
        if (ownClient) {
          await client.query('COMMIT');
        }
        const splits = await bankSplitRepository.getSplitsByTransaction(tenantId, txId);
        const transaction = await this.getTransactionById(tenantId, txId);
        if (!transaction) {
          throw new Error(`Missing bank transaction ${txId}`);
        }
        return { transaction, splits, ledgerEntries: [] };
      }

      const fromAccount = await bankAccountRepository.getAccountById(tenantId, fromAccountId);
      if (!fromAccount || fromAccount.currency !== currency) {
        if (ownClient) {
          await client.query('ROLLBACK');
        }
        throw new Error('From account not found or currency mismatch');
      }

      try {
        const ot = fromAccount.ownerType as string;
        if (ot !== 'system' && ot !== 'escrow') {
          const { requireFinancialRiskClearance } = await import('@modules/risk-identity/risk-financial-gate');
          await requireFinancialRiskClearance(tenantId, {
            actorId: payerActorId,
            action: 'financial_payment',
            amountCents,
          });
        }
      } catch (e) {
        if (ownClient) {
          await client.query('ROLLBACK');
        }
        throw e;
      }

      const targetIds = splitLines.map((l) => l.targetAccountId);
      await this.lockAccounts(client, tenantId, [fromAccountId, ...targetIds]);

      const justification =
        description.trim().length >= 10
          ? description.trim()
          : 'Service payment execution split';

      const transactionResult = await client.query<BankTransactionRow>(
        `
        INSERT INTO bank_transactions (
          tenant_id, actor_id, account_id, amount_cents, purpose, justification, reference_type, reference_id, concept_id
        )
        VALUES ($1, $2, $3, $4, 'execution', $5, $6, $7, $8)
        RETURNING id, tenant_id, actor_id, account_id, amount_cents, purpose, reference_type, reference_id, internal_completed_at, created_at
        `,
        [
          tenantId,
          payerActorId,
          fromAccountId,
          amountCents,
          justification,
          referenceType,
          referenceId,
          concept_id,
        ]
      );

      const txId = transactionResult.rows[0].id;
      const transaction = this.toTransaction(transactionResult.rows[0], fromAccountId, null);
      const splits: BankSplit[] = [];
      const ledgerEntries: Array<{
        entryId: string;
        accountId: string;
        entryType: 'credit' | 'debit';
      }> = [];

      const fromBalance = await bankLedgerRepository.calculateBalance(tenantId, fromAccountId, client);
      if (fromBalance.balanceCents < amountCents) {
        incrementMetric('insufficient_funds_attempt');
        logFinancialEvent({
          financial_event: 'transaction_insufficient_funds',
          tenant_id: tenantId,
          account_id: fromAccountId,
          amount_cents: amountCents,
        });
        throw new Error('INSUFFICIENT_FUNDS');
      }
      const fromBalanceAfter = asMoneyCents(fromBalance.balanceCents - amountCents);
      const fromEntry = await bankLedgerRepository.createEntry(
        tenantId,
        {
          accountId: fromAccountId,
          transactionId: txId,
          entryType: 'debit',
          amountCents: toPositiveMoneyCents(amountCents),
          balanceBeforeCents: fromBalance.balanceCents,
          balanceAfterCents: fromBalanceAfter,
          description: justification,
          metadata: { ...metadata, referenceType, referenceId },
          authorship,
        },
        client
      );
      ledgerEntries.push({
        entryId: fromEntry.entryId,
        accountId: fromAccountId,
        entryType: 'debit',
      });

      for (const line of splitLines) {
        const splitType: BankSplitType = line.splitType ?? 'revenue_share';
        const targetBalance = await bankLedgerRepository.calculateBalance(
          tenantId,
          line.targetAccountId,
          client
        );
        const targetBalanceAfter = asMoneyCents(targetBalance.balanceCents + line.amountCents);
        const creditEntry = await bankLedgerRepository.createEntry(
          tenantId,
          {
            accountId: line.targetAccountId,
            transactionId: txId,
            entryType: 'credit',
            amountCents: toPositiveMoneyCents(line.amountCents),
            balanceBeforeCents: targetBalance.balanceCents,
            balanceAfterCents: targetBalanceAfter,
            description: `${justification} → receiver`,
            metadata: {
              ...metadata,
              receiverActorId: line.receiverActorId,
            },
            authorship,
          },
          client
        );
        ledgerEntries.push({
          entryId: creditEntry.entryId,
          accountId: line.targetAccountId,
          entryType: 'credit',
        });

        const split = await bankSplitRepository.createSplit(
          tenantId,
          {
            transactionId: txId,
            targetAccountId: line.targetAccountId,
            amountCents: line.amountCents,
            percentage: line.percentage ?? undefined,
            splitType,
            description: justification,
            metadata: {
              ...metadata,
              receiverActorId: line.receiverActorId,
            },
            authorship,
          },
          client
        );
        splits.push(split);
      }

      const sumR = await client.query<{ s: string }>(
        `SELECT COALESCE(SUM(amount_cents), 0)::text AS s FROM bank_splits WHERE transaction_id = $1 AND tenant_id = $2`,
        [txId, tenantId]
      );
      const splitTotal = parseInt(sumR.rows[0]?.s || '0', 10);
      if (splitTotal !== amountCents) {
        if (ownClient) {
          await client.query('ROLLBACK');
        }
        throw new Error(
          `Split validation failed: transactionAmountCents ${amountCents} vs splitsSumCents ${splitTotal}`
        );
      }

      await client.query(
        `UPDATE bank_transactions SET internal_completed_at = NOW() WHERE id = $1`,
        [txId]
      );
      if (ownClient) {
        await client.query('COMMIT');
      }

      return { transaction, splits, ledgerEntries };
    } catch (e) {
      if (ownClient) {
        try {
          await client.query('ROLLBACK');
        } catch {
          /* ignore */
        }
      }
      // OUTBOX_ATOMICITY_HARDENING: quando client é externo (!ownClient),
      // NÃO fazemos ROLLBACK aqui — o caller (serviço orquestrador) é dono da
      // transação e fará o ROLLBACK de tudo (bank + execution + outbox)
      // quando receber o throw.
      throw e;
    } finally {
      if (ownClient) {
        client.release();
      }
    }
  }

  /**
   * @deprecated Prompt 51.1 — Caminho proibido. Usar `bankIntegrationService.reverseTransaction` ou
   * `requestAndExecuteReversalSync` / reversal worker (motor formal).
   */
  async reverseTransaction(
    _tenantId: string,
    originalTransactionId: string,
    _eventId?: string
  ): Promise<{
    reversalTransaction: BankTransaction;
    ledgerEntries: Array<{ entryId: string; accountId: string; entryType: 'credit' | 'debit' }>;
  }> {
    logFinancialEvent({
      financial_event: 'reverse_transaction_deprecated_blocked',
      tenant_id: _tenantId,
      transaction_id: originalTransactionId,
    });
    throw new Error(
      'REVERSE_TRANSACTION_DEPRECATED: use bankIntegrationService.reverseTransaction() or reversal engine (requestAndExecuteReversalSync)'
    );
  }

  /**
   * Busca detalhes completos de uma transação (com splits)
   */
  async getTransactionDetails(
    tenantId: string,
    transactionId: string
  ): Promise<{
    transaction: BankTransaction;
    splits: BankSplit[];
    ledgerEntries: Array<{ entryId: string; accountId: string; entryType: 'credit' | 'debit'; amountCents: number }>;
  }> {
    const transaction = await this.getTransactionById(tenantId, transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    const splits = await bankSplitRepository.getSplitsByTransaction(tenantId, transactionId);
    const ledgerEntries = await bankLedgerRepository.getEntriesByTransaction(tenantId, transactionId);

    return {
      transaction,
      splits,
      ledgerEntries: ledgerEntries.map((entry) => ({
        entryId: entry.entryId,
        accountId: entry.accountId,
        entryType: entry.entryType,
        amountCents: entry.amountCents,
      })),
    };
  }

  /**
   * Marca transação como externamente liquidada
   * SOMENTE chamar após callback confirmado de parceiro (IP/Banco)
   */
  async markExternallySettled(
    tenantId: string,
    transactionId: string,
    partnerName: string,
    partnerReference: string,
    partnerTimestamp?: Date
  ): Promise<boolean> {
    const result = await runQueryWithTenant<{ mark_externally_settled: boolean }>(
      tenantId,
      `SELECT mark_externally_settled($1, $2, $3, $4) as mark_externally_settled`,
      [transactionId, partnerName, partnerReference, partnerTimestamp || new Date()]
    );
    return result?.mark_externally_settled || false;
  }

  /**
   * Marca external_settled_at em bank_transactions pela referência do payment intent.
   *
   * Uso exclusivo: settlement de gateway via payment-event-resolver.ts.
   * Requer PoolClient com transação ativa — FOR UPDATE garante idempotência.
   * Não cria escrita financeira nova; apenas sela o timestamp de liquidação externa.
   *
   * Ref: LEIS_OPERACIONAIS_UNIFICARD.md Lei 5 (SSOT financeiro)
   */
  async markExternallySettledByReference(
    tenantId: string,
    referenceId: string,
    client: PoolClient
  ): Promise<boolean> {
    const result = await client.query<{ id: string }>(
      `UPDATE bank_transactions
       SET external_settled_at = NOW()
       WHERE id = (
         SELECT id
         FROM bank_transactions
         WHERE tenant_id = $1
           AND reference_id = $2
           AND external_settled_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE
       )
       RETURNING id`,
      [tenantId, referenceId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * DECISION-0052 §14.3: anota metadata canônica de leg reversa em
   * bank_transactions.metadata. Append seguro (jsonb || jsonb) — não
   * altera amount/account/direction; só registra rastreabilidade
   * (reversal_id, original_transaction_id, original_split_id).
   *
   * Existe porque bankTransactionService.transfer() não propaga a
   * metadata para bank_transactions (o INSERT do transfer não inclui
   * a coluna), e bank_ledger não tem coluna metadata.
   *
   * Escrita em bank_* exige residir em modules/bank/ (bank-ledger §4.6).
   */
  async appendReversalLegMetadata(
    tenantId: string,
    transactionId: string,
    metadata: {
      reversal_id: string;
      original_transaction_id: string;
      original_split_id: string;
    },
    client: PoolClient
  ): Promise<void> {
    await client.query(
      `UPDATE bank_transactions
          SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
        WHERE tenant_id = $2::uuid AND id = $3::uuid`,
      [JSON.stringify(metadata), tenantId, transactionId]
    );
  }
}

export const bankTransactionService = new BankTransactionService();








