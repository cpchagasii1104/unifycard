-- ============================================================
-- UNIFICARD - MIGRATION 093
-- Actor Scores & Penalties (Contrato v1.3)
-- ============================================================
--
-- OBJETIVO:
-- Implementar infraestrutura de reputação, penalidades
-- e responsabilização financeira de atores.
--
-- GOVERNANÇA (EXPLÍCITA):
-- - O BANCO:
--   • armazena snapshots, históricos e registros declarativos
--   • garante integridade estrutural e isolamento por tenant
-- - A APLICAÇÃO:
--   • calcula score
--   • decide penalidades
--   • executa efeitos (bloqueios, restrições, cobranças)
--
-- DECISÕES IMPORTANTES:
-- - Não há CHECKs rígidos de domínio (tipos, status, severidade)
-- - updated_at é controlado pela aplicação
-- - Histórico é imutável
--
-- DEPENDÊNCIAS:
-- - tenants
-- - actors
-- - events
--
-- IMPACTO:
-- - Infraestrutura crítica de responsabilização
-- - Nenhuma lógica de decisão no banco
-- ============================================================


-- ============================================================
-- SCORE ATUAL DO ATOR
-- ============================================================
CREATE TABLE IF NOT EXISTS actor_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,

  actor_id UUID NOT NULL
    REFERENCES actors(actor_id) ON DELETE CASCADE,

  actor_type VARCHAR(10) NOT NULL,

  current_score INTEGER NOT NULL DEFAULT 80,

  total_events_organized INTEGER DEFAULT 0,
  total_events_participated INTEGER DEFAULT 0,
  total_check_ins INTEGER DEFAULT 0,
  total_no_shows INTEGER DEFAULT 0,
  total_cancellations INTEGER DEFAULT 0,
  total_complaints_received INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT actor_scores_unique
    UNIQUE (tenant_id, actor_id, actor_type)
);


-- ============================================================
-- HISTÓRICO DE SCORE (IMUTÁVEL)
-- ============================================================
CREATE TABLE IF NOT EXISTS actor_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,

  actor_score_id UUID NOT NULL
    REFERENCES actor_scores(id) ON DELETE CASCADE,

  previous_score INTEGER NOT NULL,
  new_score INTEGER NOT NULL,
  change_amount INTEGER NOT NULL,

  reason VARCHAR(50) NOT NULL,
  event_id UUID
    REFERENCES events(id) ON DELETE SET NULL,

  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- PENALIDADES
-- ============================================================
CREATE TABLE IF NOT EXISTS actor_penalties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,

  actor_id UUID NOT NULL
    REFERENCES actors(actor_id) ON DELETE CASCADE,

  actor_type VARCHAR(10) NOT NULL,

  penalty_type VARCHAR(50) NOT NULL,

  reason VARCHAR(255) NOT NULL,
  event_id UUID
    REFERENCES events(id) ON DELETE SET NULL,

  severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',

  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,

  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

  financial_amount_cents INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);


-- ============================================================
-- DÉBITOS (RESPONSABILIZAÇÃO)
-- ============================================================
CREATE TABLE IF NOT EXISTS actor_debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,

  event_id UUID NOT NULL
    REFERENCES events(id) ON DELETE CASCADE,

  debtor_actor_id UUID NOT NULL
    REFERENCES actors(actor_id) ON DELETE CASCADE,

  debtor_actor_type VARCHAR(10) NOT NULL,

  creditor_actor_id UUID NOT NULL
    REFERENCES actors(actor_id) ON DELETE CASCADE,

  creditor_actor_type VARCHAR(10) NOT NULL,

  amount_cents INTEGER NOT NULL
    CHECK (amount_cents > 0),

  reason VARCHAR(50) NOT NULL,

  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

  guarantor_actor_id UUID
    REFERENCES actors(actor_id) ON DELETE SET NULL,

  guarantor_actor_type VARCHAR(10),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  transferred_at TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}'::jsonb
);


-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_actor_scores_actor
  ON actor_scores (tenant_id, actor_id, actor_type);

CREATE INDEX IF NOT EXISTS idx_actor_scores_score
  ON actor_scores (current_score);

CREATE INDEX IF NOT EXISTS idx_actor_score_history_actor
  ON actor_score_history (actor_score_id);

CREATE INDEX IF NOT EXISTS idx_actor_penalties_actor
  ON actor_penalties (tenant_id, actor_id, actor_type);

CREATE INDEX IF NOT EXISTS idx_actor_penalties_status
  ON actor_penalties (status);

CREATE INDEX IF NOT EXISTS idx_actor_penalties_type
  ON actor_penalties (penalty_type);

CREATE INDEX IF NOT EXISTS idx_actor_debts_debtor
  ON actor_debts (tenant_id, debtor_actor_id, debtor_actor_type);

CREATE INDEX IF NOT EXISTS idx_actor_debts_creditor
  ON actor_debts (tenant_id, creditor_actor_id, creditor_actor_type);

CREATE INDEX IF NOT EXISTS idx_actor_debts_event
  ON actor_debts (event_id);

CREATE INDEX IF NOT EXISTS idx_actor_debts_status
  ON actor_debts (status);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE actor_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_penalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_debts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS actor_scores_rls ON actor_scores;
DROP POLICY IF EXISTS actor_score_history_rls ON actor_score_history;
DROP POLICY IF EXISTS actor_penalties_rls ON actor_penalties;
DROP POLICY IF EXISTS actor_debts_rls ON actor_debts;

CREATE POLICY actor_scores_rls
  ON actor_scores
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY actor_score_history_rls
  ON actor_score_history
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY actor_penalties_rls
  ON actor_penalties
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

CREATE POLICY actor_debts_rls
  ON actor_debts
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);


-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE actor_scores IS
  'Snapshot atual de score de reputação dos atores.';

COMMENT ON TABLE actor_score_history IS
  'Histórico imutável de mudanças de score.';

COMMENT ON TABLE actor_penalties IS
  'Penalidades declarativas aplicadas a atores.';

COMMENT ON TABLE actor_debts IS
  'Débitos de responsabilização entre atores. Execução ocorre fora do banco.';













