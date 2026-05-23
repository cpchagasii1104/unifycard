-- 0045_treasury_distributions.sql
-- Distribuições de tesouraria (criadas pela governança). Não escreve em bank_transactions nem bank_ledger.

CREATE TABLE treasury_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  treasury_account_id UUID NOT NULL REFERENCES treasury_accounts(id),
  proposal_id UUID REFERENCES governance_proposals(id),
  reference_id TEXT,
  amount_cents BIGINT NOT NULL,
  distribution_type TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_treasury_distributions_account_status
  ON treasury_distributions (treasury_account_id, status);

CREATE INDEX idx_treasury_distributions_pending
  ON treasury_distributions (status) WHERE status = 'pending';

COMMENT ON TABLE treasury_distributions IS 'Distribuições de tesouraria (regional_fund_distribution, community_project_funding). Processadas via governance_financial_actions; não escreve em bank_transactions nem bank_ledger.';
