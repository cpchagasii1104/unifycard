-- 0033_financial_alerts.sql
-- Alertas operacionais financeiros (detecção de anomalias). Não altera bank_transactions nem bank_ledger.

CREATE TABLE financial_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  alert_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_financial_alerts_tenant_unresolved
  ON financial_alerts (tenant_id) WHERE resolved_at IS NULL;

CREATE INDEX idx_financial_alerts_created
  ON financial_alerts (created_at DESC);

COMMENT ON TABLE financial_alerts IS 'Alertas operacionais (LARGE_PAYOUT, SETTLEMENT_FAILED, PAYOUT_FAILED); somente leitura em dados financeiros.';
