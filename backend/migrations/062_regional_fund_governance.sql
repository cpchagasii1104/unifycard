-- ============================================================
-- UNIFICARD — MIGRATION 061
-- Arquivo: 061_regional_fund_governance.sql
-- Tipo: GOVERNANÇA FINANCEIRA / VOTAÇÃO
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Esta migration introduz o sistema de governança do Fundo Regional,
-- permitindo que usuários participem de decisões sobre o uso de
-- recursos coletivos por meio de propostas e votação.
--
-- O modelo suporta:
-- • financiamento de projetos
-- • reinvestimento regional
-- • despesas comunitárias
--
-- GOVERNANÇA FINANCEIRA
-- • Todos os valores monetários são armazenados em CENTAVOS
-- • Nenhum cálculo financeiro usa DECIMAL/FLOAT
--
-- VOTAÇÃO
-- • Um usuário = um voto por proposta
-- • Janela de votação é definida no schema
-- • Enforcement temporal ocorre na aplicação
--
-- RLS
-- • Escopo por tenant
-- • Controle por status (DRAFT/OPEN/etc.) é feito no serviço
--
-- IDEMPOTÊNCIA
-- • Todas as estruturas usam IF NOT EXISTS
-- • Triggers seguem padrão global do projeto
--
-- DEPENDÊNCIAS
-- • tenants
-- • global_users
-- • update_updated_at_column()
--
-- ============================================================


-- ============================================================
-- 1) REGIONAL FUND PROPOSALS
-- ============================================================

CREATE TABLE IF NOT EXISTS regional_fund_proposals (
  proposal_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id)
    ON DELETE CASCADE,

  region_id VARCHAR(255) NOT NULL,

  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,

  proposal_type VARCHAR(50) NOT NULL
    CHECK (proposal_type IN ('PROJECT_FUNDING', 'REGIONAL_REINVESTMENT', 'COMMUNITY_EXPENSE')),

  target_type VARCHAR(50) NOT NULL
    CHECK (target_type IN ('project', 'group', 'platform', 'regional_fund')),

  target_id UUID,

  -- VALOR FINANCEIRO (CENTAVOS)
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',

  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'OPEN', 'CLOSED', 'EXECUTED', 'REJECTED')),

  created_by UUID NOT NULL
    REFERENCES global_users(global_user_id)
    ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  voting_starts_at TIMESTAMPTZ,
  voting_ends_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT regional_fund_proposal_valid_target CHECK (
    (target_type IN ('project', 'group') AND target_id IS NOT NULL) OR
    (target_type IN ('platform', 'regional_fund') AND target_id IS NULL)
  )
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_regional_fund_proposals_tenant_region
  ON regional_fund_proposals (tenant_id, region_id);

CREATE INDEX IF NOT EXISTS idx_regional_fund_proposals_status
  ON regional_fund_proposals (status);

CREATE INDEX IF NOT EXISTS idx_regional_fund_proposals_created_by
  ON regional_fund_proposals (created_by);

CREATE INDEX IF NOT EXISTS idx_regional_fund_proposals_voting_period
  ON regional_fund_proposals (voting_starts_at, voting_ends_at)
  WHERE status = 'OPEN';

-- Trigger updated_at (padrão do projeto)
CREATE TRIGGER trg_regional_fund_proposals_updated_at
  BEFORE UPDATE ON regional_fund_proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 2) REGIONAL FUND VOTES
-- ============================================================

CREATE TABLE IF NOT EXISTS regional_fund_votes (
  vote_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  proposal_id UUID NOT NULL
    REFERENCES regional_fund_proposals(proposal_id)
    ON DELETE CASCADE,

  global_user_id UUID NOT NULL
    REFERENCES global_users(global_user_id)
    ON DELETE CASCADE,

  vote VARCHAR(10) NOT NULL CHECK (vote IN ('YES', 'NO')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT regional_fund_votes_unique
    UNIQUE (proposal_id, global_user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_regional_fund_votes_proposal
  ON regional_fund_votes (proposal_id);

CREATE INDEX IF NOT EXISTS idx_regional_fund_votes_user
  ON regional_fund_votes (global_user_id);

CREATE INDEX IF NOT EXISTS idx_regional_fund_votes_vote
  ON regional_fund_votes (vote);


-- ============================================================
-- 3) RLS (ROW LEVEL SECURITY)
-- ============================================================

ALTER TABLE regional_fund_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE regional_fund_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY regional_fund_proposals_rls
  ON regional_fund_proposals
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE POLICY regional_fund_votes_rls
  ON regional_fund_votes
  USING (
    EXISTS (
      SELECT 1
      FROM regional_fund_proposals p
      WHERE p.proposal_id = regional_fund_votes.proposal_id
        AND p.tenant_id::text = current_setting('app.current_tenant', true)
    )
  );


-- ============================================================
-- COMENTÁRIOS
-- ============================================================

COMMENT ON TABLE regional_fund_proposals IS
  'Propostas de governança para uso do fundo regional (votação coletiva)';

COMMENT ON TABLE regional_fund_votes IS
  'Votos dos usuários em propostas do fundo regional (um usuário = um voto)';

COMMENT ON COLUMN regional_fund_proposals.amount_cents IS
  'Valor solicitado em centavos (integer para evitar erros financeiros)';

COMMENT ON COLUMN regional_fund_proposals.region_id IS
  'Identificador lógico da região (estado, cidade ou outra divisão)';

COMMENT ON COLUMN regional_fund_proposals.target_id IS
  'Destino da proposta: project ou group. NULL para platform ou regional_fund';


-- ============================================================
-- FIM 061_regional_fund_governance.sql
-- ============================================================





