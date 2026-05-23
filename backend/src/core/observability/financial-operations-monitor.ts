// Financial Operations Monitor — verificações operacionais automáticas (somente leitura).
// Não altera bank_transactions, bank_ledger nem bank_accounts.

import type { Pool } from 'pg';
import { runFinancialReconciliation } from '@core/reconciliation/financial-reconciliation';

const CHECK_INTERVAL_MS = 30_000;

/**
 * Executa as verificações operacionais do sistema financeiro.
 * Apenas leitura; nenhuma escrita em estruturas financeiras.
 */
export async function runFinancialOperationsCheck(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    // A) Ledger drift: total débitos deve igualar total créditos
    const driftResult = await client.query<{ debit: string; credit: string }>(`
      SELECT
        SUM(CASE WHEN direction = 'debit' THEN amount_cents ELSE 0 END)::text AS debit,
        SUM(CASE WHEN direction = 'credit' THEN amount_cents ELSE 0 END)::text AS credit
      FROM bank_ledger
    `);
    const row = driftResult.rows[0];
    const debit = Number(row?.debit ?? 0);
    const credit = Number(row?.credit ?? 0);
    if (debit !== credit) {
      console.error('LEDGER_DRIFT_DETECTED', { debit, credit });
    }

    // B) Contas com saldo cacheado negativo (suspeito) — só se a coluna existir
    try {
      const negativeResult = await client.query<{ id: string }>(`
        SELECT id FROM bank_accounts WHERE cached_balance < 0
      `);
      if (negativeResult.rows.length > 0) {
        console.warn('NEGATIVE_BALANCE_ALERT', {
          count: negativeResult.rows.length,
          account_ids: negativeResult.rows.map((r) => r.id),
        });
      }
    } catch (_) {
      // Coluna cached_balance pode não existir no Genesis; ignorar
    }

    // C) Payouts travados: reference_type payout-related e não concluídos há mais de 1 hora
    const stuckResult = await client.query<{ id: string; tenant_id: string; reference_type: string; created_at: Date }>(`
      SELECT id, tenant_id, reference_type, created_at
      FROM bank_transactions
      WHERE reference_type IN ('payout_request', 'bank_payout')
        AND internal_completed_at IS NULL
        AND created_at < now() - interval '1 hour'
    `);
    if (stuckResult.rows.length > 0) {
      console.warn('STUCK_PAYOUT_DETECTED', {
        count: stuckResult.rows.length,
        transactions: stuckResult.rows.map((r) => ({
          id: r.id,
          tenant_id: r.tenant_id,
          reference_type: r.reference_type,
          created_at: r.created_at,
        })),
      });
    }

    // D) Reconciliação: transações sem ledger, ledger órfão, desbalanceamento por transação
    await runFinancialReconciliation(pool);
  } catch (err) {
    console.warn('[FinancialOperationsMonitor] Check failed (non-fatal):', err);
  } finally {
    client.release();
  }
}

export { CHECK_INTERVAL_MS };