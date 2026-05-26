/**
 * Prompt 52 — Reconciliation Engine: leitura + diagnóstico (não altera ledger/transactions/saldos).
 */

import { getClientWithTenant } from '@core/database/pool';
import { logFinancialEvent } from '@core/observability/financial-logger';
import type { LedgerReconciliationDiscrepancyType } from './reconciliation.repository';

export interface ReconciliationEngineResult {
  runId: string;
  status: 'completed' | 'failed';
  discrepanciesFound: number;
  metadata: Record<string, unknown>;
}

interface DiscRow {
  type: LedgerReconciliationDiscrepancyType;
  referenceId: string;
  expectedValueCents: number | null;
  actualValueCents: number | null;
  differenceCents: number;
}

/**
 * Uma transação REPEATABLE READ: snapshot consistente das leituras;
 * escrita apenas em reconciliation_runs / reconciliation_ledger_discrepancies.
 */
export async function runReconciliation(tenantId: string): Promise<ReconciliationEngineResult> {
  const client = await getClientWithTenant(tenantId);
  const metadata: Record<string, unknown> = { engine: 'prompt_52' };

  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ WRITE');

    const colCheck = await client.query<{ present: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bank_accounts'
        AND column_name = 'reconciliation_balance_cents'
      ) AS present`
    );
    const hasReconciliationBalance = colCheck.rows[0]?.present === true;
    metadata.accountCheck = hasReconciliationBalance ? 'reconciliation_balance_cents' : 'skipped_no_column';

    const txsRes = await client.query<{ id: string; amount_cents: string }>(
      `SELECT id, amount_cents::text FROM bank_transactions
       WHERE tenant_id = $1 AND internal_completed_at IS NOT NULL`,
      [tenantId]
    );

    const ledgerAggRes = await client.query<{
      transaction_id: string;
      debit_sum: string;
      credit_sum: string;
    }>(
      `SELECT transaction_id::text,
        COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount_cents ELSE 0 END), 0)::text AS debit_sum,
        COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_cents ELSE 0 END), 0)::text AS credit_sum
       FROM bank_ledger
       WHERE tenant_id = $1 AND transaction_id IS NOT NULL
       GROUP BY transaction_id`,
      [tenantId]
    );

    const orphanLedgerRes = await client.query<{ id: string; account_id: string }>(
      `SELECT id::text, account_id::text FROM bank_ledger
       WHERE tenant_id = $1 AND transaction_id IS NULL`,
      [tenantId]
    );

    const aggByTx = new Map<string, { d: number; c: number }>();
    for (const row of ledgerAggRes.rows) {
      aggByTx.set(row.transaction_id, {
        d: Number(row.debit_sum),
        c: Number(row.credit_sum),
      });
    }

    const discs: DiscRow[] = [];

    for (const tx of txsRes.rows) {
      const amount = Number(tx.amount_cents);
      const agg = aggByTx.get(tx.id);
      if (!agg || (agg.d === 0 && agg.c === 0)) {
        discs.push({
          type: 'orphan_transaction',
          referenceId: tx.id,
          expectedValueCents: amount,
          actualValueCents: 0,
          differenceCents: amount,
        });
        continue;
      }
      if (agg.d !== agg.c) {
        discs.push({
          type: 'ledger_mismatch',
          referenceId: tx.id,
          expectedValueCents: agg.d,
          actualValueCents: agg.c,
          differenceCents: Math.abs(agg.d - agg.c),
        });
        continue;
      }
      if (agg.d !== amount) {
        discs.push({
          type: 'ledger_mismatch',
          referenceId: tx.id,
          expectedValueCents: amount,
          actualValueCents: agg.d,
          differenceCents: Math.abs(amount - agg.d),
        });
      }
    }

    for (const ol of orphanLedgerRes.rows) {
      discs.push({
        type: 'orphan_ledger_entry',
        referenceId: ol.id,
        expectedValueCents: null,
        actualValueCents: null,
        differenceCents: 0,
      });
    }

    if (hasReconciliationBalance) {
      const accountsRes = await client.query<{ id: string; b: string | null }>(
        `SELECT id::text, reconciliation_balance_cents::text
         FROM bank_accounts
         WHERE tenant_id = $1 AND reconciliation_balance_cents IS NOT NULL`,
        [tenantId]
      );
      const netRes = await client.query<{ account_id: string; net: string }>(
        `SELECT account_id::text,
         COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_cents ELSE -amount_cents END), 0)::text AS net
         FROM bank_ledger WHERE tenant_id = $1 GROUP BY account_id`,
        [tenantId]
      );
      const netByAccount = new Map<string, number>();
      for (const r of netRes.rows) {
        netByAccount.set(r.account_id, Number(r.net));
      }
      for (const a of accountsRes.rows) {
        if (a.b === null) continue;
        const expected = Number(a.b);
        const actual = netByAccount.get(a.id) ?? 0;
        if (expected !== actual) {
          discs.push({
            type: 'account_mismatch',
            referenceId: a.id,
            expectedValueCents: expected,
            actualValueCents: actual,
            differenceCents: Math.abs(expected - actual),
          });
        }
      }
    }

    // Cruzamento payment_intents.settled × bank_ledger.credits via FK order_id (DT institucional 2026-05-23).
    // Detecta caso material: intent declarado liquidado sem o credit correspondente no ledger — falha silenciosa
    // de pipeline que a reconciliation atual não cobria. Puro SELECT: relata discrepância, não move dinheiro.
    const settledIntentsRes = await client.query<{ intent_id: string; amount_cents: string }>(
      `SELECT pi.id::text AS intent_id, pi.amount_cents::text
       FROM payment_intents pi
       WHERE pi.tenant_id = $1
         AND pi.payment_status = 'settled'
         AND pi.order_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM bank_transactions bt
           INNER JOIN bank_ledger bl ON bl.transaction_id = bt.id AND bl.tenant_id = bt.tenant_id
           WHERE bt.tenant_id = pi.tenant_id
             AND bt.order_id = pi.order_id
             AND bl.direction = 'credit'
             AND bl.amount_cents > 0
         )`,
      [tenantId]
    );

    for (const intent of settledIntentsRes.rows) {
      const amount = Number(intent.amount_cents);
      discs.push({
        type: 'settled_intent_without_credit',
        referenceId: intent.intent_id,
        expectedValueCents: amount,
        actualValueCents: 0,
        differenceCents: amount,
      });
    }

    // Caminho 2 — Checagem B: payout_requests transferido mas status não-completed.
    // Janela material: payout-worker (workers/payout-worker.ts:82-95) executa
    // processPayout (transfer COMMITED no bank, referenceType='seller_payout')
    // ANTES de updatePayoutStatus('completed') em transação separada. Se o
    // processo morre entre os dois, transfer aconteceu mas status fica
    // 'processing' (claim só pega 'requested', logo NÃO retoma). Detecção pura:
    // listar payout_requests com transfer bank correspondente mas status !=
    // 'completed' (= dinheiro saiu, status órfão). Reconciliation NÃO corrige —
    // só reporta. Recovery/endurecimento de worker é decisão futura governada
    // pela frequência que esta detecção medir.
    const payoutDiscRes = await client.query<{
      payout_id: string;
      pr_status: string;
      amount_cents: string;
    }>(
      `SELECT pr.id::text AS payout_id, pr.status AS pr_status, pr.amount_cents::text
         FROM payout_requests pr
         INNER JOIN bank_transactions bt
           ON bt.tenant_id = pr.tenant_id
          AND bt.reference_type = 'seller_payout'
          AND bt.reference_id = pr.id::text
        WHERE pr.tenant_id = $1
          AND pr.status != 'completed'`,
      [tenantId]
    );

    for (const row of payoutDiscRes.rows) {
      const amount = Number(row.amount_cents);
      discs.push({
        type: 'payout_transferred_status_not_completed',
        referenceId: row.payout_id,
        expectedValueCents: amount,
        actualValueCents: amount, // dinheiro fluiu; status ficou para trás
        differenceCents: 0, // não é divergência de saldo, é de observabilidade
      });
    }

    // Caminho 2 — Checagem C: bank_settlements transferido mas status não-sent.
    // Janela material: bank-settlement-worker (workers/bank-settlement-worker.ts:44-107)
    // executa executeSettlementEffects com 2 efeitos isolados via withIdempotency:
    // efeito 1 (transfer seller_payout → bank_settlement, referenceType=
    // 'bank_settlement') e efeito 2 (updateSettlementStatus('sent')). Cada um
    // é uma transação separada. Se o processo morre entre eles, transfer
    // commitado mas status fica 'processing'. listPendingSettlements filtra só
    // status='pending', logo NÃO retoma — só reprocessSettlement MANUAL
    // (runbook). Detecção pura aqui torna o caso visível sem ação automática.
    const settlementDiscRes = await client.query<{
      settlement_id: string;
      bs_status: string;
      amount_cents: string;
    }>(
      `SELECT bs.id::text AS settlement_id, bs.status AS bs_status, bs.amount_cents::text
         FROM bank_settlements bs
         INNER JOIN bank_transactions bt
           ON bt.tenant_id = bs.tenant_id
          AND bt.reference_type = 'bank_settlement'
          AND bt.reference_id = bs.id::text
        WHERE bs.tenant_id = $1
          AND bs.status != 'sent'`,
      [tenantId]
    );

    for (const row of settlementDiscRes.rows) {
      const amount = Number(row.amount_cents);
      discs.push({
        type: 'settlement_transferred_status_not_sent',
        referenceId: row.settlement_id,
        expectedValueCents: amount,
        actualValueCents: amount, // dinheiro fluiu; status ficou para trás
        differenceCents: 0, // não é divergência de saldo, é de observabilidade
      });
    }

    const runInsert = await client.query<{ id: string; started_at: Date }>(
      `INSERT INTO reconciliation_runs (tenant_id, status, metadata, discrepancies_found)
       VALUES ($1, 'running', $2::jsonb, 0)
       RETURNING id, started_at`,
      [tenantId, JSON.stringify(metadata)]
    );
    const runId = runInsert.rows[0].id;

    for (const d of discs) {
      await client.query(
        `INSERT INTO reconciliation_ledger_discrepancies (
           tenant_id, reconciliation_run_id, discrepancy_type, reference_id,
           expected_value_cents, actual_value_cents, difference_cents
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          tenantId,
          runId,
          d.type,
          d.referenceId,
          d.expectedValueCents,
          d.actualValueCents,
          d.differenceCents,
        ]
      );
    }

    await client.query(
      `UPDATE reconciliation_runs
       SET status = 'completed', finished_at = now(), discrepancies_found = $2,
           metadata = metadata || $3::jsonb
       WHERE id = $1`,
      [runId, discs.length, JSON.stringify({ discrepanciesFound: discs.length })]
    );

    await client.query('COMMIT');

    const startedAt = runInsert.rows[0].started_at.toISOString();
    logFinancialEvent({
      financial_event: 'reconciliation_run_started',
      tenant_id: tenantId,
      metadata: { runId, startedAt },
    });
    for (const d of discs) {
      logFinancialEvent({
        financial_event: 'reconciliation_discrepancy_detected',
        tenant_id: tenantId,
        reference_id: d.referenceId,
        metadata: {
          runId,
          type: d.type,
          expected_value_cents: d.expectedValueCents,
          actual_value_cents: d.actualValueCents,
          difference_cents: d.differenceCents,
        },
      });
    }
    logFinancialEvent({
      financial_event: 'reconciliation_run_completed',
      tenant_id: tenantId,
      metadata: { runId, discrepanciesFound: discs.length, status: 'completed' },
    });

    return {
      runId,
      status: 'completed',
      discrepanciesFound: discs.length,
      metadata: { ...metadata, discrepanciesFound: discs.length },
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    logFinancialEvent({
      financial_event: 'reconciliation_run_completed',
      tenant_id: tenantId,
      metadata: {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  } finally {
    client.release();
  }
}