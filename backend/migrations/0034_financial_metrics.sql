-- 0034_financial_metrics.sql
-- Métricas operacionais financeiras agregadas (dashboard/observabilidade). Não altera bank_transactions nem bank_ledger.

CREATE TABLE financial_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL,
  metric_value BIGINT NOT NULL,
  metric_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX uq_financial_metrics_type_date
  ON financial_metrics (metric_type, metric_date);

CREATE INDEX idx_financial_metrics_type_date
  ON financial_metrics (metric_type, metric_date);

COMMENT ON TABLE financial_metrics IS 'Métricas agregadas (total_volume, total_payouts, total_settlements, total_transactions); somente leitura em dados financeiros.';
