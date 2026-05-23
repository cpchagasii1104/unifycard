-- 0047_governance_funding.sql
-- Pedidos de financiamento por governança (proposta aprovada → PaymentIntent). Não escreve em bank_transactions nem bank_ledger.

CREATE TABLE governance_funding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  proposal_id UUID NOT NULL,
  treasury_account_id UUID NOT NULL REFERENCES treasury_accounts(id),
  project_reference TEXT,
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT uq_governance_funding_proposal UNIQUE (proposal_id)
);

CREATE INDEX idx_governance_funding_proposal
  ON governance_funding (proposal_id);

CREATE INDEX idx_governance_funding_pending
  ON governance_funding (status) WHERE status = 'pending';

CREATE INDEX idx_governance_funding_tenant
  ON governance_funding (tenant_id);

COMMENT ON TABLE governance_funding IS 'Pedidos de financiamento por governança (proposta aprovada → PaymentIntent). Processado pelo Governance Funding Worker; não escreve em bank_transactions nem bank_ledger.';
