-- ============================================================
-- UNIFICARD — MIGRATION 054
-- Arquivo: 054_social_purpose_targeting.sql
-- Tipo: EVOLUÇÃO SOCIAL (propósito + targeting)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- O Social 2.0 passa a suportar posts com propósito explícito
-- (intent), permitindo experiências mais ricas como:
-- • ofertas de serviços/produtos
-- • projetos colaborativos
-- • votações
-- • eventos e bookings
--
-- OBJETIVO
-- • Adicionar intent semântico aos posts
-- • Permitir targeting inteligente baseado em Raio-X
-- • Estruturar extensões de post (votes, projects)
--
-- MODELO DE DADOS
-- • posts.intent           → propósito principal do post
-- • posts.intent_metadata  → dados específicos por intent (schema-free)
-- • posts.targeting        → filtros/sugestões algorítmicas (Raio-X)
--
-- REGRAS CRÍTICAS (NÃO VIOLAR)
-- • intent NÃO controla permissão, apenas semântica
-- • targeting é sugestão, não bloqueio duro
-- • intent_metadata não tem schema fixo por design
-- • consistência de tenant deve ser garantida
--
-- ESCOPO
-- ✔ Adiciona intent, intent_metadata e targeting em posts
-- ✔ Cria post_votes (intent = vote)
-- ✔ Cria post_projects (intent = project)
-- ✔ Cria índices para feed e lookup
--
-- ❌ Não implementa algoritmo de feed
-- ❌ Não cria contadores agregados
-- ❌ Não implementa regras de visibilidade
--
-- DEPENDÊNCIAS
-- • posts
-- • tenants
-- • actors
-- • groups
--
-- OBSERVAÇÕES IMPORTANTES
-- • Votos são associados a actors (não usuários diretamente)
-- • Um actor pode votar apenas uma vez por post
-- • Projetos são extensões de posts, não entidades independentes
-- • intent_metadata e targeting são JSONB flexíveis e evolutivos
--
-- IDEMPOTÊNCIA
-- • Todas as alterações usam IF NOT EXISTS ou guards
-- • Pode ser executada múltiplas vezes com segurança
--
-- ============================================================


-- ============================================================
-- 1) POSTS — intent e targeting
-- ============================================================

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS intent VARCHAR(50) NOT NULL DEFAULT 'personal',
ADD COLUMN IF NOT EXISTS intent_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS targeting JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Constraint de intent válido
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'posts_intent_check'
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT posts_intent_check CHECK (
        intent IN (
          'personal',
          'friends',
          'booking',
          'service_offer',
          'product_offer',
          'project',
          'vote',
          'event'
        )
      );
  END IF;
END $$;

-- Índices para feed
CREATE INDEX IF NOT EXISTS idx_posts_intent
  ON posts (tenant_id, intent);

CREATE INDEX IF NOT EXISTS idx_posts_targeting
  ON posts USING GIN (targeting)
  WHERE targeting <> '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_posts_intent_metadata
  ON posts USING GIN (intent_metadata)
  WHERE intent_metadata <> '{}'::jsonb;


-- ============================================================
-- 2) POST_VOTES (intent = vote)
-- ============================================================

CREATE TABLE IF NOT EXISTS post_votes (
  vote_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  post_id UUID NOT NULL
    REFERENCES posts(post_id)
    ON DELETE CASCADE,

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id)
    ON DELETE CASCADE,

  actor_id UUID NOT NULL
    REFERENCES actors(actor_id)
    ON DELETE CASCADE,

  option_index INTEGER NOT NULL CHECK (option_index >= 0),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT post_votes_unique_actor
    UNIQUE (post_id, actor_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_post_votes_post
  ON post_votes (tenant_id, post_id);

CREATE INDEX IF NOT EXISTS idx_post_votes_actor
  ON post_votes (tenant_id, actor_id);

-- RLS
ALTER TABLE post_votes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'post_votes'
      AND policyname = 'post_votes_rls'
  ) THEN
    CREATE POLICY post_votes_rls
      ON post_votes
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- Consistência de tenant
CREATE OR REPLACE FUNCTION post_votes_enforce_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_t UUID;
BEGIN
  SELECT tenant_id INTO v_t FROM posts WHERE post_id = NEW.post_id;
  IF v_t IS NULL THEN RAISE EXCEPTION 'post_votes: post not found'; END IF;
  IF NEW.tenant_id <> v_t THEN
    RAISE EXCEPTION 'post_votes: tenant mismatch';
  END IF;

  SELECT tenant_id INTO v_t FROM actors WHERE actor_id = NEW.actor_id;
  IF v_t IS NULL THEN RAISE EXCEPTION 'post_votes: actor not found'; END IF;
  IF NEW.tenant_id <> v_t THEN
    RAISE EXCEPTION 'post_votes: tenant mismatch';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_post_votes_tenant') THEN
    CREATE TRIGGER trg_post_votes_tenant
      BEFORE INSERT OR UPDATE ON post_votes
      FOR EACH ROW
      EXECUTE FUNCTION post_votes_enforce_tenant();
  END IF;
END $$;


-- ============================================================
-- 3) POST_PROJECTS (intent = project)
-- ============================================================

CREATE TABLE IF NOT EXISTS post_projects (
  project_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  post_id UUID NOT NULL
    REFERENCES posts(post_id)
    ON DELETE CASCADE,

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id)
    ON DELETE CASCADE,

  group_id UUID NOT NULL
    REFERENCES groups(group_id)
    ON DELETE CASCADE,

  budget_cents INTEGER CHECK (budget_cents IS NULL OR budget_cents >= 0),
  deadline TIMESTAMPTZ,

  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','completed','cancelled')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT post_projects_unique_post UNIQUE (post_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_post_projects_post
  ON post_projects (tenant_id, post_id);

CREATE INDEX IF NOT EXISTS idx_post_projects_group
  ON post_projects (tenant_id, group_id);

CREATE INDEX IF NOT EXISTS idx_post_projects_active
  ON post_projects (tenant_id, status)
  WHERE status = 'active';

-- RLS
ALTER TABLE post_projects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'post_projects'
      AND policyname = 'post_projects_rls'
  ) THEN
    CREATE POLICY post_projects_rls
      ON post_projects
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- Trigger updated_at (padrão)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_post_projects_updated_at') THEN
    CREATE TRIGGER trg_post_projects_updated_at
      BEFORE UPDATE ON post_projects
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Consistência de tenant
CREATE OR REPLACE FUNCTION post_projects_enforce_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_t UUID;
BEGIN
  SELECT tenant_id INTO v_t FROM posts WHERE post_id = NEW.post_id;
  IF v_t IS NULL THEN RAISE EXCEPTION 'post_projects: post not found'; END IF;
  IF NEW.tenant_id <> v_t THEN
    RAISE EXCEPTION 'post_projects: tenant mismatch';
  END IF;

  SELECT tenant_id INTO v_t FROM groups WHERE group_id = NEW.group_id;
  IF v_t IS NULL THEN RAISE EXCEPTION 'post_projects: group not found'; END IF;
  IF NEW.tenant_id <> v_t THEN
    RAISE EXCEPTION 'post_projects: tenant mismatch';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_post_projects_tenant') THEN
    CREATE TRIGGER trg_post_projects_tenant
      BEFORE INSERT OR UPDATE ON post_projects
      FOR EACH ROW
      EXECUTE FUNCTION post_projects_enforce_tenant();
  END IF;
END $$;


-- ============================================================
-- COMENTÁRIOS
-- ============================================================

COMMENT ON COLUMN posts.intent IS
  'Propósito semântico do post (personal, service_offer, project, vote, etc.)';

COMMENT ON COLUMN posts.intent_metadata IS
  'Metadados específicos do intent (schema flexível)';

COMMENT ON COLUMN posts.targeting IS
  'Direcionamento inteligente baseado no Raio-X do CORE';

COMMENT ON TABLE post_votes IS
  'Votos em posts com intent = vote (um actor = um voto)';

COMMENT ON TABLE post_projects IS
  'Projetos de grupo baseados em posts com intent = project';


-- ============================================================
-- FIM 054_social_purpose_targeting.sql
-- ============================================================
