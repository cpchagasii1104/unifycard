-- 0048_governance_funding_commitments.sql
-- Camada de commitment (intenção auditável) entre Governance e Execução (Bank).
-- Commitment NÃO move dinheiro; NÃO representa saldo. Execução valida saldo real no bank.

CREATE TABLE governance_funding_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  proposal_id UUID NOT NULL,
  treasury_account_id UUID NOT NULL REFERENCES treasury_accounts(id),
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  project_reference TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT unique_proposal_commitment UNIQUE (proposal_id),
  CONSTRAINT chk_status CHECK (status IN ('pending', 'processing', 'executed', 'failed'))
);

CREATE INDEX idx_governance_funding_commitments_pending
  ON governance_funding_commitments (status) WHERE status = 'pending';

CREATE INDEX idx_governance_funding_commitments_tenant_status
  ON governance_funding_commitments (tenant_id, status);

COMMENT ON TABLE governance_funding_commitments IS 'Intenção auditável de financiamento por governança. Não move dinheiro; execução valida saldo em bank_accounts e executa via bank_transaction (treasury → escrow).';
