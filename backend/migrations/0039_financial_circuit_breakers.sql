-- 0039_financial_circuit_breakers.sql
-- Circuit breakers financeiros: pausar operações em caso de risco sistêmico.
-- Não altera bank_transactions, bank_ledger nem bank_accounts.

CREATE TABLE financial_circuit_breakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  breaker_type TEXT NOT NULL,
  status TEXT NOT NULL,
  trigger_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  released_at TIMESTAMPTZ
);

CREATE INDEX idx_financial_circuit_breakers_tenant_type_status
  ON financial_circuit_breakers (tenant_id, breaker_type, status);

COMMENT ON TABLE financial_circuit_breakers IS 'Circuit breakers: payments, payouts, settlements. status: active | released.';
