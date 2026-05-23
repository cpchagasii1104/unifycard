-- 0044_treasury_accounts.sql
-- Contas de tesouraria institucional (fundos regionais, comunitários, reservas). Não altera bank_transactions nem bank_ledger.

CREATE TABLE treasury_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  treasury_type TEXT NOT NULL,
  account_id UUID NOT NULL REFERENCES bank_accounts(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_treasury_accounts_tenant_type
  ON treasury_accounts (tenant_id, treasury_type);

CREATE INDEX idx_treasury_accounts_account
  ON treasury_accounts (account_id);

COMMENT ON TABLE treasury_accounts IS 'Contas de tesouraria (regional_fund, community_fund, system_reserve, governance_pool). Referencia bank_accounts; não escreve em bank_transactions nem bank_ledger.';
