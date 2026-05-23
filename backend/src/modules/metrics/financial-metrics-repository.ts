// Financial Metrics Repository — tabela financial_metrics (agregação para dashboard).
// Não altera bank_transactions, bank_ledger nem bank_accounts.

import { pool } from '@core/database/pool';

export interface FinancialMetricRow {
  id: string;
  metric_type: string;
  metric_value: string;
  metric_date: string;
  created_at: Date;
}

/**
 * Insere ou atualiza métrica para (metric_type, metric_date). Um registro por tipo por dia.
 */
export async function recordMetric(
  metricType: string,
  metricValue: number,
  metricDate: Date
): Promise<void> {
  const dateStr = metricDate.toISOString().slice(0, 10); // YYYY-MM-DD
  await pool.query(
    `INSERT INTO financial_metrics (metric_type, metric_value, metric_date)
     VALUES ($1, $2, $3::date)
     ON CONFLICT (metric_type, metric_date)
     DO UPDATE SET metric_value = EXCLUDED.metric_value, created_at = now()`,
    [metricType, metricValue, dateStr]
  );
}

/**
 * Retorna métricas do tipo no intervalo de datas (inclusive).
 */
export async function getMetricsByDate(
  metricType: string,
  startDate: Date,
  endDate: Date
): Promise<{ metricDate: string; metricValue: number }[]> {
  const start = startDate.toISOString().slice(0, 10);
  const end = endDate.toISOString().slice(0, 10);
  const result = await pool.query<{ metric_date: string; metric_value: string }>(
    `SELECT metric_date::text, metric_value::text
     FROM financial_metrics
     WHERE metric_type = $1 AND metric_date >= $2::date AND metric_date <= $3::date
     ORDER BY metric_date ASC`,
    [metricType, start, end]
  );
  return result.rows.map((r) => ({
    metricDate: r.metric_date,
    metricValue: parseInt(r.metric_value, 10),
  }));
}