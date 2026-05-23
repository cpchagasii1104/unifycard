-- 0037_financial_freezes.sql
-- Congelamento de valores por conta (disputa/antifraude). Não altera bank_transactions nem bank_ledger.

CREATE TABLE financial_freezes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  account_id UUID NOT NULL,
  reference_id TEXT NOT NULL,
  amount_cents BIGINT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  released_at TIMESTAMPTZ
);

CREATE INDEX idx_financial_freezes_tenant_account_status
  ON financial_freezes (tenant_id, account_id, status);

COMMENT ON TABLE financial_freezes IS 'Congelamento de saldo por conta (disputa/antifraude); não altera transações já registradas.';
