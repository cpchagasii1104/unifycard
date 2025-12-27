-- ================================================
-- MIGRATION 061: REGIONAL FUND GOVERNANCE
-- FASE 8: Governança do Fundo Regional
-- ================================================

-- ===========================
-- REGIONAL FUND PROPOSALS
-- ===========================
CREATE TABLE IF NOT EXISTS regional_fund_proposals (
  proposal_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  region_id VARCHAR(255) NOT NULL, -- ID da região (pode ser stateId ou outro identificador)
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  proposal_type VARCHAR(50) NOT NULL CHECK (proposal_type IN ('PROJECT_FUNDING', 'REGIONAL_REINVESTMENT', 'COMMUNITY_EXPENSE')),
  target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('project', 'group', 'platform', 'regional_fund')),
  target_id UUID, -- Nullable: pode ser null para platform ou regional_fund
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'OPEN', 'CLOSED', 'EXECUTED', 'REJECTED')),
  created_by UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  voting_starts_at TIMESTAMPTZ,
  voting_ends_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT proposal_valid_target CHECK (
    (target_type IN ('project', 'group') AND target_id IS NOT NULL) OR
    (target_type IN ('platform', 'regional_fund') AND target_id IS NULL)
  )
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_regional_fund_proposals_tenant_region ON regional_fund_proposals(tenant_id, region_id);
CREATE INDEX IF NOT EXISTS idx_regional_fund_proposals_status ON regional_fund_proposals(status);
CREATE INDEX IF NOT EXISTS idx_regional_fund_proposals_created_by ON regional_fund_proposals(created_by);
CREATE INDEX IF NOT EXISTS idx_regional_fund_proposals_voting_period ON regional_fund_proposals(voting_starts_at, voting_ends_at) WHERE status = 'OPEN';

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_regional_fund_proposals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_regional_fund_proposals_updated_at
  BEFORE UPDATE ON regional_fund_proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_regional_fund_proposals_updated_at();

-- ===========================
-- REGIONAL FUND VOTES
-- ===========================
CREATE TABLE IF NOT EXISTS regional_fund_votes (
  vote_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposal_id UUID NOT NULL REFERENCES regional_fund_proposals(proposal_id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  vote VARCHAR(10) NOT NULL CHECK (vote IN ('YES', 'NO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_proposal_vote UNIQUE (proposal_id, global_user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_regional_fund_votes_proposal ON regional_fund_votes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_regional_fund_votes_user ON regional_fund_votes(global_user_id);
CREATE INDEX IF NOT EXISTS idx_regional_fund_votes_vote ON regional_fund_votes(vote);

-- ===========================
-- RLS (Row Level Security)
-- ===========================
ALTER TABLE regional_fund_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE regional_fund_votes ENABLE ROW LEVEL SECURITY;

-- Política para proposals: usuários do mesmo tenant podem ver
CREATE POLICY regional_fund_proposals_rls ON regional_fund_proposals
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Política para votes: usuários do mesmo tenant podem ver
CREATE POLICY regional_fund_votes_rls ON regional_fund_votes
  USING (
    EXISTS (
      SELECT 1 FROM regional_fund_proposals p
      WHERE p.proposal_id = regional_fund_votes.proposal_id
        AND p.tenant_id::text = current_setting('app.current_tenant', true)
    )
  );

-- ===========================
-- COMENTÁRIOS
-- ===========================
COMMENT ON TABLE regional_fund_proposals IS 'Propostas de uso do fundo regional';
COMMENT ON TABLE regional_fund_votes IS 'Votos dos usuários em propostas do fundo regional';
COMMENT ON COLUMN regional_fund_proposals.region_id IS 'ID da região (pode ser stateId ou outro identificador)';
COMMENT ON COLUMN regional_fund_proposals.target_id IS 'ID do destino (project ou group). Null para platform ou regional_fund';
COMMENT ON COLUMN regional_fund_votes.vote IS 'Voto do usuário: YES ou NO';















