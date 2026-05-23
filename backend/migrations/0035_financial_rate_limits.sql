-- 0035_financial_rate_limits.sql
-- Rate limit por tenant/actor para proteção contra abuso. Não altera bank_transactions nem bank_ledger.

CREATE TABLE financial_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  action_count INT NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX uq_financial_rate_limits_window
  ON financial_rate_limits (tenant_id, actor_id, action_type, window_start);

CREATE INDEX idx_financial_rate_limits_lookup
  ON financial_rate_limits (tenant_id, actor_id, action_type, window_start);

COMMENT ON TABLE financial_rate_limits IS 'Contadores de rate limit (payment_attempt, payout_request, webhook_event); não altera dados financeiros.';
