// Financial Metrics Worker — agrega métricas operacionais (total_volume, total_payouts, total_settlements, total_transactions).
// Não altera bank_transactions, bank_ledger nem bank_accounts. Somente leitura dessas tabelas + escrita em financial_metrics.

import { pool } from '@core/database/pool';
import { recordMetric } from '@modules/metrics/financial-metrics-repository';

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function runMetricsCycle(): Promise<void> {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    // A) total_volume: SUM(amount_cents) FROM bank_transactions WHERE created_at >= today
    const volumeResult = await pool.query<{ sum: string }>(`
      SELECT COALESCE(SUM(amount_cents), 0)::text as sum
      FROM bank_transactions
      WHERE created_at >= $1::date
    `, [todayStr]);
    const totalVolume = parseInt(volumeResult.rows[0]?.sum ?? '0', 10);
    await recordMetric('total_volume', totalVolume, today);

    // B) total_payouts: SUM(amount_cents) FROM payout_requests WHERE status = 'completed' AND created_at >= today
    const payoutsResult = await pool.query<{ sum: string }>(`
      SELECT COALESCE(SUM(amount_cents), 0)::text as sum
      FROM payout_requests
      WHERE status = 'completed' AND created_at >= $1::date
    `, [todayStr]);
    const totalPayouts = parseInt(payoutsResult.rows[0]?.sum ?? '0', 10);
    await recordMetric('total_payouts', totalPayouts, today);

    // C) total_settlements: SUM(amount_cents) FROM bank_settlements WHERE status = 'sent' AND created_at >= today
    const settlementsResult = await pool.query<{ sum: string }>(`
      SELECT COALESCE(SUM(amount_cents), 0)::text as sum
      FROM bank_settlements
      WHERE status = 'sent' AND created_at >= $1::date
    `, [todayStr]);
    const totalSettlements = parseInt(settlementsResult.rows[0]?.sum ?? '0', 10);
    await recordMetric('total_settlements', totalSettlements, today);

    // D) total_transactions: COUNT(*) FROM bank_transactions WHERE created_at >= today
    const countResult = await pool.query<{ count: string }>(`
      SELECT COUNT(*)::text as count
      FROM bank_transactions
      WHERE created_at >= $1::date
    `, [todayStr]);
    const totalTransactions = parseInt(countResult.rows[0]?.count ?? '0', 10);
    await recordMetric('total_transactions', totalTransactions, today);
  } catch (err) {
    console.error('[FinancialMetricsWorker] Cycle error:', err);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startFinancialMetricsWorker(): void {
  if (intervalId !== null) return;
  runMetricsCycle().catch((err) => console.error('[FinancialMetricsWorker] Initial run error:', err));
  intervalId = setInterval(runMetricsCycle, INTERVAL_MS);
  console.log('[FinancialMetricsWorker] Started (aggregation every 5min)');
}