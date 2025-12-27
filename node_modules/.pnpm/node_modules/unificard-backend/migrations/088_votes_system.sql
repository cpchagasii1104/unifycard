-- ================================================
-- UNIFICARD - MIGRATION 088
-- Votes System - Sistema de Votações
-- MVP funcional para governança social
-- ================================================

-- ===========================
-- VOTES (Votações)
-- ===========================
CREATE TABLE IF NOT EXISTS votes (
  vote_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  created_by_actor_id UUID NOT NULL REFERENCES actors(actor_id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_votes_tenant ON votes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_votes_status ON votes (status) WHERE status IN ('active', 'closed');
CREATE INDEX IF NOT EXISTS idx_votes_created_by ON votes (created_by_actor_id);
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_votes_dates ON votes (starts_at, ends_at) WHERE starts_at IS NOT NULL AND ends_at IS NOT NULL;

-- RLS
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY votes_rls ON votes
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ===========================
-- VOTE_OPTIONS (Opções de Votação)
-- ===========================
CREATE TABLE IF NOT EXISTS vote_options (
  option_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vote_id UUID NOT NULL REFERENCES votes(vote_id) ON DELETE CASCADE,
  label VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_vote_options_vote ON vote_options (vote_id);

-- RLS
ALTER TABLE vote_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY vote_options_rls ON vote_options
  USING (
    EXISTS (
      SELECT 1 FROM votes
      WHERE votes.vote_id = vote_options.vote_id
      AND votes.tenant_id::text = current_setting('app.current_tenant', true)
    )
  );

-- ===========================
-- VOTE_RESPONSES (Respostas/Votos)
-- ===========================
CREATE TABLE IF NOT EXISTS vote_responses (
  response_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vote_id UUID NOT NULL REFERENCES votes(vote_id) ON DELETE CASCADE,
  vote_option_id UUID NOT NULL REFERENCES vote_options(option_id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES actors(actor_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(vote_id, actor_id) -- Garante 1 voto por actor por votação
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_vote_responses_vote ON vote_responses (vote_id);
CREATE INDEX IF NOT EXISTS idx_vote_responses_option ON vote_responses (vote_option_id);
CREATE INDEX IF NOT EXISTS idx_vote_responses_actor ON vote_responses (actor_id);
CREATE INDEX IF NOT EXISTS idx_vote_responses_unique ON vote_responses (vote_id, actor_id);

-- RLS
ALTER TABLE vote_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY vote_responses_rls ON vote_responses
  USING (
    EXISTS (
      SELECT 1 FROM votes
      WHERE votes.vote_id = vote_responses.vote_id
      AND votes.tenant_id::text = current_setting('app.current_tenant', true)
    )
  );

-- Trigger para atualizar updated_at em votes
CREATE OR REPLACE FUNCTION update_votes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_votes_updated_at
  BEFORE UPDATE ON votes
  FOR EACH ROW
  EXECUTE FUNCTION update_votes_updated_at();

-- Comentários
COMMENT ON TABLE votes IS 'Votações do sistema de governança';
COMMENT ON TABLE vote_options IS 'Opções disponíveis para cada votação';
COMMENT ON TABLE vote_responses IS 'Votos registrados (1 por actor por votação)';
COMMENT ON COLUMN votes.status IS 'Status: draft (rascunho), active (ativa), closed (encerrada)';








