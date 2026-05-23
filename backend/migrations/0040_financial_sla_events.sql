-- 0040_financial_sla_events.sql
-- Eventos de SLA financeiro (atrasos operacionais). Não altera bank_transactions, bank_ledger nem bank_accounts.

CREATE TABLE financial_sla_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  sla_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  expected_at TIMESTAMPTZ NOT NULL,
  actual_at TIMESTAMPTZ NOT NULL,
  delay_seconds INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_financial_sla_events_tenant_type
  ON financial_sla_events (tenant_id, sla_type);

CREATE INDEX idx_financial_sla_events_created
  ON financial_sla_events (created_at DESC);

COMMENT ON TABLE financial_sla_events IS 'SLA breaches: settlement_delay, payout_delay, bank_settlement_delay. Somente leitura em dados financeiros.';
