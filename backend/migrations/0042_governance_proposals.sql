-- 0042_governance_proposals.sql
-- Propostas de governança (decisões coletivas). Não altera bank_transactions nem bank_ledger.

CREATE TABLE governance_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  proposal_type TEXT NOT NULL,
  reference_id TEXT,
  payload JSONB DEFAULT '{}',
  status TEXT NOT NULL,
  votes_for INT NOT NULL DEFAULT 0,
  votes_against INT NOT NULL DEFAULT 0,
  voting_deadline TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_governance_proposals_tenant_status
  ON governance_proposals (tenant_id, status);

CREATE INDEX idx_governance_proposals_deadline
  ON governance_proposals (voting_deadline) WHERE status = 'open';

COMMENT ON TABLE governance_proposals IS 'Propostas de governança (fund_allocation, community_project_funding, etc). status: open | approved | rejected | executed.';
