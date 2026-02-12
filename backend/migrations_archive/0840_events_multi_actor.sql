-- ============================================================
-- UNIFICARD - MIGRATION 087
-- FASE 18: Events Multi-Actor System (Cultural)
-- ============================================================
--
-- OBJETIVO:
-- Permitir que múltiplos Perfis de Atuação Cultural (PAC)
-- participem de um evento cultural com papéis, permissões
-- e intenção declarativa de divisão de receita.
--
-- GOVERNANÇA (EXPLÍCITA):
-- - O BANCO:
--   • armazena relações N:N entre eventos culturais e PACs
--   • não executa regras de publicação
--   • não executa lógica financeira
-- - A APLICAÇÃO:
--   • decide quando um evento pode ser publicado
--   • valida papéis obrigatórios (artist, venue, etc)
--   • executa split real via SplitEngine / Ledger
--
-- DECISÕES IMPORTANTES:
-- - Papéis e status são campos livres (sem CHECK rígido)
-- - revenue_share_percent é declarativo
-- - updated_at é controlado pela aplicação
--
-- DEPENDÊNCIAS:
-- - tenants
-- - cultural_events
-- - cultural_profiles
--
-- IMPACTO:
-- - Nenhuma alteração destrutiva
-- - Executa isoladamente
-- ============================================================


-- ============================================================
-- RELACIONAMENTO MULTI-ATOR (PAC ↔ EVENTO)
-- ============================================================
CREATE TABLE IF NOT EXISTS cultural_event_actor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,

  cultural_event_id UUID NOT NULL
    REFERENCES cultural_events(id) ON DELETE CASCADE,

  cultural_profile_id UUID NOT NULL
    REFERENCES cultural_profiles(id) ON DELETE CASCADE,

  role VARCHAR(50) NOT NULL,

  can_publish BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,

  revenue_share_percent NUMERIC(5,2),

  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT cultural_event_actor_unique
    UNIQUE (cultural_event_id, cultural_profile_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cultural_event_actor_event
  ON cultural_event_actor (cultural_event_id);

CREATE INDEX IF NOT EXISTS idx_cultural_event_actor_profile
  ON cultural_event_actor (cultural_profile_id);

CREATE INDEX IF NOT EXISTS idx_cultural_event_actor_tenant
  ON cultural_event_actor (tenant_id);

CREATE INDEX IF NOT EXISTS idx_cultural_event_actor_role
  ON cultural_event_actor (role);

CREATE INDEX IF NOT EXISTS idx_cultural_event_actor_status
  ON cultural_event_actor (status);


-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE cultural_event_actor ENABLE ROW LEVEL SECURITY;

CREATE POLICY cultural_event_actor_rls
  ON cultural_event_actor
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);


-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE cultural_event_actor IS
  'Relacionamento N:N entre eventos culturais e Perfis de Atuação Cultural (PAC).';

COMMENT ON COLUMN cultural_event_actor.role IS
  'Papel do PAC no evento (artist, venue, organizer, sponsor, supporter, etc).';

COMMENT ON COLUMN cultural_event_actor.can_publish IS
  'Indica se o PAC pode publicar o evento. Regra efetiva é da aplicação.';

COMMENT ON COLUMN cultural_event_actor.can_edit IS
  'Indica se o PAC pode editar o evento. Regra efetiva é da aplicação.';

COMMENT ON COLUMN cultural_event_actor.revenue_share_percent IS
  'Intenção declarativa de divisão de receita. Execução ocorre via SplitEngine.';

COMMENT ON COLUMN cultural_event_actor.status IS
  'Status da participação do PAC no evento (pending, accepted, rejected, removed).';
