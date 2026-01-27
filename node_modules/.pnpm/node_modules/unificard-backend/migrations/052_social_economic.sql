-- ============================================================
-- UNIFICARD — MIGRATION 052
-- Arquivo: 052_social_economic_cta_group_profit_ledger.sql
-- Tipo: SISTEMA SOCIAL ECONÔMICO (CTA + repasse + ledger)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Social Econômico conecta conteúdo (posts) com ações transacionais:
-- • CTA em posts (agendar/contratar/pagar)
-- • repasse configurável para grupos (profit_percentage)
-- • ledger social/econômico append-only para rastreabilidade
--
-- OBJETIVO
-- • Criar post_cta para CTAs vinculados a posts e atores/grupos
-- • Adicionar configuração de percentual de repasse em groups
-- • Criar social_ledger como fonte imutável (append-only) de impacto
--
-- MODELO DE DADOS
-- • post_cta: CTA por post, opcionalmente apontando para actor e/ou group
-- • groups.profit_percentage: percentual (0–100) de repasse configurável
-- • social_ledger: eventos financeiros/impacto (append-only)
--
-- REGRAS CRÍTICAS (NÃO VIOLAR)
-- • Consistência de tenant: tenant_id do registro deve bater com tenant_id
--   de entidades referenciadas (posts, actors, groups, transactions)
-- • social_ledger é append-only: não permitir UPDATE/DELETE
-- • updated_at segue padrão do projeto: update_updated_at_column()
-- • RLS deve conter USING + WITH CHECK para evitar escrita em tenant errado
--
-- ESCOPO
-- ✔ Cria tabela post_cta + índices + RLS + trigger updated_at
-- ✔ Adiciona colunas profit_percentage e profit_config_metadata em groups
-- ✔ Cria social_ledger + índices + RLS + bloqueio de UPDATE/DELETE
-- ✔ Garante consistência de tenant via triggers (onde FK não garante)
--
-- ❌ Não calcula repasses automaticamente
-- ❌ Não cria motor de settlement/conciliation
-- ❌ Não define visibilidade avançada (público/privado) para CTAs
--
-- DEPENDÊNCIAS
-- • tenants
-- • posts
-- • actors (migration 050)
-- • groups (migration 037)
-- • transactions
-- • função update_updated_at_column()
-- • extensão uuid-ossp
--
-- OBSERVAÇÕES IMPORTANTES
-- • CTA pode apontar para actor e/ou group (ambos opcionais), mas
--   recomenda-se que ao menos um destino exista para CTAs econômicos
--   (o schema permite ambos NULL para suportar rascunhos/preview).
-- • currency é ISO-4217 (3 letras). O schema valida formato, não lista.
-- • social_ledger registra amount >= 0 e tipos limitados (revenue, profit_share,
--   donation, commission). Não há suporte a estorno aqui (virá via eventos).
-- • groups_profit_percentage_check deve ser idempotente (guard por pg_constraint).
--
-- IDEMPOTÊNCIA
-- • CREATE TABLE/INDEX usam IF NOT EXISTS
-- • Policies, triggers e constraints usam guards
-- • Pode ser executada múltiplas vezes com segurança
--
-- ============================================================

-- ============================================================
-- EXTENSÃO
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1) POST_CTA (Call-to-Action nos posts)
-- ============================================================

CREATE TABLE IF NOT EXISTS post_cta (
  cta_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id)
    ON DELETE CASCADE,

  post_id UUID NOT NULL
    REFERENCES posts(post_id)
    ON DELETE CASCADE,

  cta_type VARCHAR(20) NOT NULL
    CHECK (cta_type IN ('booking', 'service', 'payment')),

  -- Destinos (opcionais por design)
  target_actor_id UUID
    REFERENCES actors(actor_id)
    ON DELETE SET NULL,

  target_group_id UUID
    REFERENCES groups(group_id)
    ON DELETE SET NULL,

  price NUMERIC(12,2)
    CHECK (price IS NULL OR price >= 0),

  currency CHAR(3) NOT NULL DEFAULT 'BRL'
    CHECK (currency ~ '^[A-Z]{3}$'),

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices (incluindo tenant para seletividade multi-tenant)
CREATE INDEX IF NOT EXISTS idx_post_cta_tenant_post
  ON post_cta (tenant_id, post_id);

CREATE INDEX IF NOT EXISTS idx_post_cta_tenant_type
  ON post_cta (tenant_id, cta_type);

CREATE INDEX IF NOT EXISTS idx_post_cta_group
  ON post_cta (target_group_id)
  WHERE target_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_post_cta_actor
  ON post_cta (target_actor_id)
  WHERE target_actor_id IS NOT NULL;

-- RLS (USING + WITH CHECK)
ALTER TABLE post_cta ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'post_cta'
      AND policyname = 'post_cta_rls'
  ) THEN
    CREATE POLICY post_cta_rls
      ON post_cta
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- Trigger updated_at (padrão do projeto)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_post_cta_updated_at'
  ) THEN
    CREATE TRIGGER trg_post_cta_updated_at
      BEFORE UPDATE ON post_cta
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Consistência de tenant em referências (posts / actors / groups)
CREATE OR REPLACE FUNCTION post_cta_enforce_tenant_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_post_tenant UUID;
  v_actor_tenant UUID;
  v_group_tenant UUID;
BEGIN
  SELECT tenant_id INTO v_post_tenant
  FROM posts
  WHERE post_id = NEW.post_id;

  IF v_post_tenant IS NULL THEN
    RAISE EXCEPTION 'post_cta: post % not found', NEW.post_id;
  END IF;

  IF NEW.tenant_id <> v_post_tenant THEN
    RAISE EXCEPTION 'post_cta: tenant mismatch (cta.tenant_id=%, post.tenant_id=%)',
      NEW.tenant_id, v_post_tenant;
  END IF;

  IF NEW.target_actor_id IS NOT NULL THEN
    SELECT tenant_id INTO v_actor_tenant
    FROM actors
    WHERE actor_id = NEW.target_actor_id;

    IF v_actor_tenant IS NULL THEN
      RAISE EXCEPTION 'post_cta: actor % not found', NEW.target_actor_id;
    END IF;

    IF NEW.tenant_id <> v_actor_tenant THEN
      RAISE EXCEPTION 'post_cta: tenant mismatch (cta.tenant_id=%, actor.tenant_id=%)',
        NEW.tenant_id, v_actor_tenant;
    END IF;
  END IF;

  IF NEW.target_group_id IS NOT NULL THEN
    SELECT tenant_id INTO v_group_tenant
    FROM groups
    WHERE group_id = NEW.target_group_id;

    IF v_group_tenant IS NULL THEN
      RAISE EXCEPTION 'post_cta: group % not found', NEW.target_group_id;
    END IF;

    IF NEW.tenant_id <> v_group_tenant THEN
      RAISE EXCEPTION 'post_cta: tenant mismatch (cta.tenant_id=%, group.tenant_id=%)',
        NEW.tenant_id, v_group_tenant;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_post_cta_enforce_tenant'
  ) THEN
    CREATE TRIGGER trg_post_cta_enforce_tenant
      BEFORE INSERT OR UPDATE ON post_cta
      FOR EACH ROW
      EXECUTE FUNCTION post_cta_enforce_tenant_consistency();
  END IF;
END $$;

COMMENT ON TABLE post_cta IS
  'Call-to-Action em posts (booking/service/payment) com destinos opcionais (actor/group)';


-- ============================================================
-- 2) GROUP_PROFIT_CONFIG (Percentual de repasse por grupo)
-- ============================================================

ALTER TABLE groups
ADD COLUMN IF NOT EXISTS profit_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00;

ALTER TABLE groups
ADD COLUMN IF NOT EXISTS profit_config_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Constraint idempotente: percentual entre 0 e 100
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'groups_profit_percentage_check'
  ) THEN
    ALTER TABLE groups
      ADD CONSTRAINT groups_profit_percentage_check
      CHECK (profit_percentage BETWEEN 0 AND 100);
  END IF;
END $$;

COMMENT ON COLUMN groups.profit_percentage IS
  'Percentual de repasse que o grupo recebe (0–100) em transações associadas';


-- ============================================================
-- 3) SOCIAL_LEDGER (Ledger imutável / append-only)
-- ============================================================

CREATE TABLE IF NOT EXISTS social_ledger (
  ledger_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id)
    ON DELETE CASCADE,

  -- Origem
  post_id UUID
    REFERENCES posts(post_id)
    ON DELETE SET NULL,

  cta_id UUID
    REFERENCES post_cta(cta_id)
    ON DELETE SET NULL,

  transaction_id UUID
    REFERENCES transactions(transaction_id)
    ON DELETE SET NULL,

  -- Destino
  recipient_actor_id UUID
    REFERENCES actors(actor_id)
    ON DELETE SET NULL,

  recipient_group_id UUID
    REFERENCES groups(group_id)
    ON DELETE SET NULL,

  -- Valores
  amount NUMERIC(12,2) NOT NULL
    CHECK (amount >= 0),

  currency CHAR(3) NOT NULL DEFAULT 'BRL'
    CHECK (currency ~ '^[A-Z]{3}$'),

  amount_type VARCHAR(20) NOT NULL
    CHECK (amount_type IN ('revenue', 'profit_share', 'donation', 'commission')),

  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices (incluindo tenant)
CREATE INDEX IF NOT EXISTS idx_social_ledger_tenant_created
  ON social_ledger (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_ledger_post
  ON social_ledger (post_id)
  WHERE post_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_ledger_actor
  ON social_ledger (recipient_actor_id)
  WHERE recipient_actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_ledger_group
  ON social_ledger (recipient_group_id)
  WHERE recipient_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_ledger_type
  ON social_ledger (amount_type);

-- RLS (USING + WITH CHECK)
ALTER TABLE social_ledger ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'social_ledger'
      AND policyname = 'social_ledger_rls'
  ) THEN
    CREATE POLICY social_ledger_rls
      ON social_ledger
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- Append-only: bloquear UPDATE/DELETE
CREATE OR REPLACE FUNCTION social_ledger_block_mutations()
RETURNS TRIGGER
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
  RAISE EXCEPTION 'social_ledger is append-only: UPDATE/DELETE is not allowed';
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_social_ledger_no_update'
  ) THEN
    CREATE TRIGGER trg_social_ledger_no_update
      BEFORE UPDATE ON social_ledger
      FOR EACH ROW
      EXECUTE FUNCTION social_ledger_block_mutations();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_social_ledger_no_delete'
  ) THEN
    CREATE TRIGGER trg_social_ledger_no_delete
      BEFORE DELETE ON social_ledger
      FOR EACH ROW
      EXECUTE FUNCTION social_ledger_block_mutations();
  END IF;
END $$;

-- Consistência de tenant (origem/destino) — onde FK não garante
CREATE OR REPLACE FUNCTION social_ledger_enforce_tenant_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_t UUID;
BEGIN
  IF NEW.post_id IS NOT NULL THEN
    SELECT tenant_id INTO v_t FROM posts WHERE post_id = NEW.post_id;
    IF v_t IS NULL THEN RAISE EXCEPTION 'social_ledger: post % not found', NEW.post_id; END IF;
    IF NEW.tenant_id <> v_t THEN
      RAISE EXCEPTION 'social_ledger: tenant mismatch (ledger %, post %)', NEW.tenant_id, v_t;
    END IF;
  END IF;

  IF NEW.cta_id IS NOT NULL THEN
    SELECT tenant_id INTO v_t FROM post_cta WHERE cta_id = NEW.cta_id;
    IF v_t IS NULL THEN RAISE EXCEPTION 'social_ledger: cta % not found', NEW.cta_id; END IF;
    IF NEW.tenant_id <> v_t THEN
      RAISE EXCEPTION 'social_ledger: tenant mismatch (ledger %, cta %)', NEW.tenant_id, v_t;
    END IF;
  END IF;

  IF NEW.transaction_id IS NOT NULL THEN
    -- transactions pode ser multi-tenant ou single-tenant; aqui assumimos que existe tenant_id em transactions.
    -- Se NÃO existir tenant_id em transactions no seu schema, remova este bloco e documente a exceção.
    BEGIN
      SELECT tenant_id INTO v_t FROM transactions WHERE transaction_id = NEW.transaction_id;
      IF v_t IS NOT NULL AND NEW.tenant_id <> v_t THEN
        RAISE EXCEPTION 'social_ledger: tenant mismatch (ledger %, transaction %)', NEW.tenant_id, v_t;
      END IF;
    EXCEPTION WHEN undefined_column THEN
      -- Sem tenant_id em transactions: não validar aqui, mas manter coerência por policy/queries.
      NULL;
    END;
  END IF;

  IF NEW.recipient_actor_id IS NOT NULL THEN
    SELECT tenant_id INTO v_t FROM actors WHERE actor_id = NEW.recipient_actor_id;
    IF v_t IS NULL THEN RAISE EXCEPTION 'social_ledger: actor % not found', NEW.recipient_actor_id; END IF;
    IF NEW.tenant_id <> v_t THEN
      RAISE EXCEPTION 'social_ledger: tenant mismatch (ledger %, actor %)', NEW.tenant_id, v_t;
    END IF;
  END IF;

  IF NEW.recipient_group_id IS NOT NULL THEN
    SELECT tenant_id INTO v_t FROM groups WHERE group_id = NEW.recipient_group_id;
    IF v_t IS NULL THEN RAISE EXCEPTION 'social_ledger: group % not found', NEW.recipient_group_id; END IF;
    IF NEW.tenant_id <> v_t THEN
      RAISE EXCEPTION 'social_ledger: tenant mismatch (ledger %, group %)', NEW.tenant_id, v_t;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_social_ledger_enforce_tenant'
  ) THEN
    CREATE TRIGGER trg_social_ledger_enforce_tenant
      BEFORE INSERT ON social_ledger
      FOR EACH ROW
      EXECUTE FUNCTION social_ledger_enforce_tenant_consistency();
  END IF;
END $$;

COMMENT ON TABLE social_ledger IS
  'Ledger social/econômico append-only para rastreabilidade de impacto (imutável)';

-- ============================================================
-- FIM 052_social_economic_cta_group_profit_ledger.sql
-- ============================================================













