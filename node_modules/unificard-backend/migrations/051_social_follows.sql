-- ============================================================
-- UNIFICARD — MIGRATION 051
-- Arquivo: 051_social_follows.sql
-- Tipo: SISTEMA SOCIAL (seguir actors)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Social 2.0 introduz o conceito de actors (user/page/group/channel).
-- Este módulo implementa o relacionamento "seguir" entre actors.
--
-- OBJETIVO
-- • Permitir que um actor siga outro actor
-- • Garantir integridade (sem duplicidade, sem auto-follow)
-- • Isolar por tenant com RLS
--
-- MODELO DE DADOS
-- • follower_actor_id → actor que segue
-- • actor_id          → actor seguido
-- • relação direcional
--
-- REGRAS CRÍTICAS (NÃO VIOLAR)
-- • Um actor não pode seguir a si mesmo
-- • Um follower não pode seguir o mesmo actor duas vezes
-- • tenant_id do follow deve bater com tenant_id dos dois actors
--
-- ESCOPO
-- ✔ Cria tabela follows
-- ✔ Cria índices para consultas por seguido/seguidor
-- ✔ Aplica RLS com USING + WITH CHECK
-- ✔ Garante consistência de tenant via trigger
--
-- ❌ Não implementa mute/block
-- ❌ Não implementa follow privado (request/approve)
--
-- DEPENDÊNCIAS
-- • tenants
-- • actors (migration 050)
-- • função update_updated_at_column() (não usada aqui)
--
-- OBSERVAÇÕES IMPORTANTES
-- • A unicidade é por (actor_id, follower_actor_id). Como actor_id é UUID
--   global, não é necessário incluir tenant_id na UNIQUE.
-- • Em workloads grandes, queries típicas são:
--   - "quem eu sigo?" (follower_actor_id)
--   - "quem me segue?" (actor_id)
--
-- IDEMPOTÊNCIA
-- • CREATE TABLE/INDEX usam IF NOT EXISTS
-- • Policy/trigger são protegidos por guards
--
-- ============================================================

-- ============================================================
-- 1) FOLLOWS
-- ============================================================

CREATE TABLE IF NOT EXISTS follows (
  follow_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id)
    ON DELETE CASCADE,

  -- Actor seguido
  actor_id UUID NOT NULL
    REFERENCES actors(actor_id)
    ON DELETE CASCADE,

  -- Actor seguidor
  follower_actor_id UUID NOT NULL
    REFERENCES actors(actor_id)
    ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT follows_unique
    UNIQUE (actor_id, follower_actor_id),

  CONSTRAINT follows_no_self
    CHECK (actor_id <> follower_actor_id)
);

-- ============================================================
-- 2) ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_follows_actor
  ON follows (actor_id);

CREATE INDEX IF NOT EXISTS idx_follows_follower
  ON follows (follower_actor_id);

CREATE INDEX IF NOT EXISTS idx_follows_tenant
  ON follows (tenant_id);

CREATE INDEX IF NOT EXISTS idx_follows_created
  ON follows (created_at DESC);

-- ============================================================
-- 3) INTEGRIDADE: tenant_id deve bater com actors
-- ============================================================

CREATE OR REPLACE FUNCTION follows_enforce_tenant_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_actor_tenant UUID;
  v_follower_tenant UUID;
BEGIN
  SELECT tenant_id INTO v_actor_tenant
  FROM actors
  WHERE actor_id = NEW.actor_id;

  IF v_actor_tenant IS NULL THEN
    RAISE EXCEPTION 'Actor % not found', NEW.actor_id;
  END IF;

  SELECT tenant_id INTO v_follower_tenant
  FROM actors
  WHERE actor_id = NEW.follower_actor_id;

  IF v_follower_tenant IS NULL THEN
    RAISE EXCEPTION 'Follower actor % not found', NEW.follower_actor_id;
  END IF;

  IF NEW.tenant_id <> v_actor_tenant OR NEW.tenant_id <> v_follower_tenant THEN
    RAISE EXCEPTION 'Tenant mismatch in follows: follows.tenant_id=%, actor.tenant_id=%, follower.tenant_id=%',
      NEW.tenant_id, v_actor_tenant, v_follower_tenant;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_follows_enforce_tenant'
  ) THEN
    CREATE TRIGGER trg_follows_enforce_tenant
      BEFORE INSERT OR UPDATE ON follows
      FOR EACH ROW
      EXECUTE FUNCTION follows_enforce_tenant_consistency();
  END IF;
END $$;

-- ============================================================
-- 4) RLS
-- ============================================================

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'follows'
      AND policyname = 'follows_rls'
  ) THEN
    CREATE POLICY follows_rls
      ON follows
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================

COMMENT ON TABLE follows IS
  'Relação de follow entre actors (A segue B), isolado por tenant';

-- ============================================================
-- FIM 051_social_follows.sql
-- ============================================================













