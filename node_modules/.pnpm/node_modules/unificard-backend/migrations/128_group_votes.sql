-- ============================================================
-- UNIFICARD - MIGRATION 122
-- Sistema de Votações de Grupo (V1)
-- ============================================================
--
-- OBJETIVO:
-- Permitir que grupos criem votações vinculadas ao motor social (Feed).
-- Votações são ações sociais, não financeiras.
--
-- DECISÕES V1:
-- - vote_type: SINGLE apenas (não criar coluna)
-- - closes_at: opcional
-- - fechamento: manual (admin/owner)
-- - opções: mínimo 2, máximo 20 (validação app-level)
--
-- DEPENDÊNCIAS:
-- - tenants
-- - groups
-- - global_users
--
-- ============================================================

-- ============================================================
-- TABELA: group_votes
-- ============================================================
CREATE TABLE IF NOT EXISTS group_votes (
  vote_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  group_id UUID NOT NULL,
  created_by_user_id TEXT NOT NULL, -- global_user_id
  title TEXT NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  closes_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Foreign keys
  CONSTRAINT fk_group_votes_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_group_votes_group FOREIGN KEY (group_id) REFERENCES groups(group_id) ON DELETE CASCADE,
  
  -- CHECK constraints
  CONSTRAINT chk_group_votes_title_length CHECK (char_length(title) >= 3 AND char_length(title) <= 200),
  CONSTRAINT chk_group_votes_description_length CHECK (description IS NULL OR char_length(description) <= 2000)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_votes_group ON group_votes(tenant_id, group_id, status);
CREATE INDEX IF NOT EXISTS idx_votes_closes ON group_votes(status, closes_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_votes_tenant ON group_votes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_votes_created_by ON group_votes(created_by_user_id);

-- RLS
ALTER TABLE group_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_votes_rls ON group_votes
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TABELA: group_vote_options
-- ============================================================
CREATE TABLE IF NOT EXISTS group_vote_options (
  option_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  text TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Foreign keys
  CONSTRAINT fk_group_vote_options_vote FOREIGN KEY (vote_id) REFERENCES group_votes(vote_id) ON DELETE CASCADE,
  CONSTRAINT fk_group_vote_options_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  
  -- CHECK constraints
  CONSTRAINT chk_group_vote_options_text_length CHECK (char_length(text) >= 1 AND char_length(text) <= 500)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_options_vote ON group_vote_options(tenant_id, vote_id);
CREATE INDEX IF NOT EXISTS idx_options_display_order ON group_vote_options(vote_id, display_order);

-- RLS
ALTER TABLE group_vote_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_vote_options_rls ON group_vote_options
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TABELA: group_vote_responses
-- ============================================================
CREATE TABLE IF NOT EXISTS group_vote_responses (
  response_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id UUID NOT NULL,
  option_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  user_id TEXT NOT NULL, -- global_user_id
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Foreign keys
  CONSTRAINT fk_group_vote_responses_vote FOREIGN KEY (vote_id) REFERENCES group_votes(vote_id) ON DELETE CASCADE,
  CONSTRAINT fk_group_vote_responses_option FOREIGN KEY (option_id) REFERENCES group_vote_options(option_id) ON DELETE CASCADE,
  CONSTRAINT fk_group_vote_responses_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  
  -- UNIQUE constraint: usuário só pode votar uma vez por votação
  CONSTRAINT group_vote_responses_unique UNIQUE (vote_id, user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_responses_vote ON group_vote_responses(tenant_id, vote_id);
CREATE INDEX IF NOT EXISTS idx_responses_option ON group_vote_responses(tenant_id, option_id);
CREATE INDEX IF NOT EXISTS idx_responses_user ON group_vote_responses(tenant_id, user_id);

-- RLS
ALTER TABLE group_vote_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_vote_responses_rls ON group_vote_responses
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE group_votes IS 'Votações criadas em grupos';
COMMENT ON TABLE group_vote_options IS 'Opções de resposta para cada votação';
COMMENT ON TABLE group_vote_responses IS 'Votos dos usuários em votações';
COMMENT ON COLUMN group_votes.created_by_user_id IS 'global_user_id de quem criou a votação';
COMMENT ON COLUMN group_vote_responses.user_id IS 'global_user_id de quem votou';
COMMENT ON COLUMN group_votes.closes_at IS 'Data/hora de encerramento automático (opcional). Fechamento manual via PATCH /close';
