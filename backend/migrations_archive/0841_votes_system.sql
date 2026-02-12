-- ============================================================
-- UNIFICARD - MIGRATION 088
-- Votes System - Sistema de Votações
-- ============================================================
--
-- OBJETIVO:
-- Implementar um sistema mínimo de votações para governança
-- social, com opções e respostas por ator.
--
-- GOVERNANÇA (EXPLÍCITA):
-- - O BANCO:
--   • armazena votações, opções e votos
--   • garante 1 voto por ator por votação
--   • isola dados por tenant
-- - A APLICAÇÃO:
--   • controla status da votação
--   • valida janelas de tempo (starts_at / ends_at)
--   • decide permissões de voto
-- - Nenhuma lógica de workflow ocorre no banco
--
-- DEPENDÊNCIAS:
-- - tenants
-- - actors
--
-- IMPACTO:
-- - Nenhuma alteração destrutiva
-- - Executa isoladamente
-- ============================================================


-- ============================================================
-- VOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS votes (
  vote_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,

  title VARCHAR(500) NOT NULL,
  description TEXT,

  status VARCHAR(20) NOT NULL DEFAULT 'draft',

  created_by_actor_id UUID NOT NULL
    REFERENCES actors(actor_id) ON DELETE CASCADE,

  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_votes_tenant
  ON votes (tenant_id);

CREATE INDEX IF NOT EXISTS idx_votes_status
  ON votes (status);

CREATE INDEX IF NOT EXISTS idx_votes_created_by
  ON votes (created_by_actor_id);

CREATE INDEX IF NOT EXISTS idx_votes_created_at
  ON votes (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_votes_dates
  ON votes (starts_at, ends_at)
  WHERE starts_at IS NOT NULL AND ends_at IS NOT NULL;

-- RLS
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY votes_rls
  ON votes
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);


-- ============================================================
-- VOTE OPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS vote_options (
  option_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  vote_id UUID NOT NULL
    REFERENCES votes(vote_id) ON DELETE CASCADE,

  label VARCHAR(255) NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_vote_options_vote
  ON vote_options (vote_id);

-- RLS
ALTER TABLE vote_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY vote_options_rls
  ON vote_options
  USING (
    EXISTS (
      SELECT 1
      FROM votes
      WHERE votes.vote_id = vote_options.vote_id
        AND votes.tenant_id = current_setting('app.current_tenant', true)::uuid
    )
  );


-- ============================================================
-- VOTE RESPONSES
-- ============================================================
CREATE TABLE IF NOT EXISTS vote_responses (
  response_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  vote_id UUID NOT NULL
    REFERENCES votes(vote_id) ON DELETE CASCADE,

  vote_option_id UUID NOT NULL
    REFERENCES vote_options(option_id) ON DELETE CASCADE,

  actor_id UUID NOT NULL
    REFERENCES actors(actor_id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT vote_responses_unique
    UNIQUE (vote_id, actor_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_vote_responses_vote
  ON vote_responses (vote_id);

CREATE INDEX IF NOT EXISTS idx_vote_responses_option
  ON vote_responses (vote_option_id);

CREATE INDEX IF NOT EXISTS idx_vote_responses_actor
  ON vote_responses (actor_id);

-- RLS
ALTER TABLE vote_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY vote_responses_rls
  ON vote_responses
  USING (
    EXISTS (
      SELECT 1
      FROM votes
      WHERE votes.vote_id = vote_responses.vote_id
        AND votes.tenant_id = current_setting('app.current_tenant', true)::uuid
    )
  );


-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE votes IS
  'Votações do sistema de governança social.';

COMMENT ON TABLE vote_options IS
  'Opções disponíveis para cada votação.';

COMMENT ON TABLE vote_responses IS
  'Votos registrados. Um voto por ator por votação.';

COMMENT ON COLUMN votes.status IS
  'Estado da votação controlado pela aplicação (ex: draft, active, closed).';













