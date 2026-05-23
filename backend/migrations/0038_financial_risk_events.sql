-- 0038_financial_risk_events.sql
-- Eventos de risco financeiro (detecção de padrões suspeitos). Não altera bank_transactions nem bank_ledger.

CREATE TABLE financial_risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  risk_type TEXT NOT NULL,
  risk_score INT NOT NULL,
  reference_id TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_financial_risk_events_tenant_actor_type
  ON financial_risk_events (tenant_id, actor_id, risk_type);

CREATE INDEX idx_financial_risk_events_created
  ON financial_risk_events (created_at DESC);

COMMENT ON TABLE financial_risk_events IS 'Eventos de risco (MANY_PAYOUTS, LARGE_TRANSACTION, MANY_PAYMENT_ATTEMPTS); somente leitura em dados financeiros.';
