-- 0036_financial_disputes.sql
-- Disputas financeiras (registro e status). Não altera bank_transactions nem bank_ledger.

CREATE TABLE financial_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  reference_id TEXT NOT NULL,
  dispute_type TEXT NOT NULL,
  amount_cents BIGINT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_financial_disputes_tenant_status
  ON financial_disputes (tenant_id, status);

CREATE INDEX idx_financial_disputes_reference
  ON financial_disputes (tenant_id, reference_id);

COMMENT ON TABLE financial_disputes IS 'Registro de disputas (chargeback, reembolso); não altera ledger nem transações.';
