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