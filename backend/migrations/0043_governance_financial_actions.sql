-- 0043_governance_financial_actions.sql
-- Ações financeiras disparadas pela governança (intents). Não escreve em bank_transactions nem bank_ledger.

CREATE TABLE governance_financial_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  proposal_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  reference_id TEXT,
  payload JSONB DEFAULT '{}',
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_governance_financial_actions_proposal_status
  ON governance_financial_actions (proposal_id, status);

CREATE INDEX idx_governance_financial_actions_pending
  ON governance_financial_actions (status) WHERE status = 'pending';

COMMENT ON TABLE governance_financial_actions IS 'Ações financeiras de governança (fund_allocation, etc). Processadas via PaymentIntent; não escreve em bank_transactions nem bank_ledger.';
