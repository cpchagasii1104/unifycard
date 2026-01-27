-- ============================================================
-- UNIFICARD — MIGRATION 053
-- Arquivo: 053_social_ledger_hardening.sql
-- Tipo: HARDENING CRÍTICO (dinheiro / ledger)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- social_ledger é um ledger append-only (imutável) que registra
-- impacto social/econômico. Por ser “dinheiro”, o schema precisa
-- ser robusto contra:
-- • erros de precisão (DECIMAL)
-- • duplicação (idempotência)
-- • vazamento lógico multi-tenant
--
-- OBJETIVO
-- • Introduzir amount_cents (INTEGER) para valores monetários
-- • Migrar dados existentes (amount -> amount_cents) com segurança
-- • Adicionar idempotency_key e unicidade parcial
-- • Adicionar owner_actor_id para rastreabilidade e filtros
-- • Reforçar policy e consistência de tenant
-- • Preservar comportamento append-only do social_ledger
--
-- REGRAS CRÍTICAS (NÃO VIOLAR)
-- • social_ledger permanece append-only (UPDATE/DELETE bloqueados)
-- • Migração deve ser idempotente
-- • tenant_id deve ser consistente com entidades referenciadas
--
-- DEPENDÊNCIAS
-- • social_ledger (migration 052)
-- • actors (migration 050)
-- • função social_ledger_block_mutations() e triggers append-only (migration 052)
--
-- OBSERVAÇÕES IMPORTANTES
-- • Esta migration precisa executar UPDATE em social_ledger para migrar
--   amount -> amount_cents. Como o ledger é append-only, a migration
--   desabilita temporariamente os triggers de bloqueio e recria ao final.
-- • amount (NUMERIC) NÃO é removido aqui por compatibilidade/validação gradual.
--   A remoção pode ser feita em migration futura após auditoria.
-- • RLS permanece por tenant (decisão consciente). owner_actor_id é adicionado
--   para filtros/observabilidade e potencial hardening futuro.
-- • A constraint de “fonte obrigatória” permanece no serviço por enquanto.
--
-- IDEMPOTÊNCIA
-- • Todas as alterações usam IF NOT EXISTS ou guards
-- • Triggers/policies/constraints são criados com proteção
--
-- ============================================================


-- ============================================================
-- 0) PREP: permitir migração (desabilitar bloqueio append-only)
-- ============================================================

DO $$
BEGIN
  -- Se os triggers append-only existirem (migration 052), removê-los temporariamente
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_social_ledger_no_update') THEN
    DROP TRIGGER trg_social_ledger_no_update ON social_ledger;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_social_ledger_no_delete') THEN
    DROP TRIGGER trg_social_ledger_no_delete ON social_ledger;
  END IF;
END $$;


-- ============================================================
-- 1) MIGRAR amount NUMERIC -> amount_cents INTEGER
-- ============================================================

-- 1.1 Adicionar coluna (sem NOT NULL por enquanto)
ALTER TABLE social_ledger
ADD COLUMN IF NOT EXISTS amount_cents INTEGER;

-- 1.2 Migrar dados existentes (se a coluna amount existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'social_ledger'
      AND column_name = 'amount'
  ) THEN
    UPDATE social_ledger
    SET amount_cents = ROUND(COALESCE(amount, 0) * 100)::INTEGER
    WHERE amount_cents IS NULL;
  END IF;
END $$;

-- 1.3 Garantir DEFAULT para novos inserts (só se ainda estiver NULL na definição)
ALTER TABLE social_ledger
ALTER COLUMN amount_cents SET DEFAULT 0;

-- 1.4 Tornar NOT NULL após migração
ALTER TABLE social_ledger
ALTER COLUMN amount_cents SET NOT NULL;

-- 1.5 Validação: amount_cents >= 0 (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'social_ledger_amount_cents_check'
  ) THEN
    ALTER TABLE social_ledger
      ADD CONSTRAINT social_ledger_amount_cents_check
      CHECK (amount_cents >= 0);
  END IF;
END $$;


-- ============================================================
-- 2) IDEMPOTÊNCIA (evitar duplicação)
-- ============================================================

ALTER TABLE social_ledger
ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_social_ledger_idempotency
  ON social_ledger (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;


-- ============================================================
-- 3) OWNER ACTOR (rastreabilidade e hardening futuro)
-- ============================================================

ALTER TABLE social_ledger
ADD COLUMN IF NOT EXISTS owner_actor_id UUID
  REFERENCES actors(actor_id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_social_ledger_owner_actor
  ON social_ledger (owner_actor_id)
  WHERE owner_actor_id IS NOT NULL;


-- ============================================================
-- 4) RLS (recriar policy com USING + WITH CHECK)
-- ============================================================

ALTER TABLE social_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_ledger_rls ON social_ledger;

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


-- ============================================================
-- 5) CONSISTÊNCIA DE TENANT (estender validação do 052)
-- ============================================================
-- A migration 052 criou social_ledger_enforce_tenant_consistency().
-- Aqui fazemos OR REPLACE para incluir owner_actor_id quando presente.
-- Também mantém validações existentes para post/cta/transaction/recipient.

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
    -- Se transactions tiver tenant_id, validamos; se não, não quebramos a migration.
    BEGIN
      SELECT tenant_id INTO v_t FROM transactions WHERE transaction_id = NEW.transaction_id;
      IF v_t IS NOT NULL AND NEW.tenant_id <> v_t THEN
        RAISE EXCEPTION 'social_ledger: tenant mismatch (ledger %, transaction %)', NEW.tenant_id, v_t;
      END IF;
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;
  END IF;

  IF NEW.recipient_actor_id IS NOT NULL THEN
    SELECT tenant_id INTO v_t FROM actors WHERE actor_id = NEW.recipient_actor_id;
    IF v_t IS NULL THEN RAISE EXCEPTION 'social_ledger: actor % not found', NEW.recipient_actor_id; END IF;
    IF NEW.tenant_id <> v_t THEN
      RAISE EXCEPTION 'social_ledger: tenant mismatch (ledger %, recipient_actor %)', NEW.tenant_id, v_t;
    END IF;
  END IF;

  IF NEW.recipient_group_id IS NOT NULL THEN
    SELECT tenant_id INTO v_t FROM groups WHERE group_id = NEW.recipient_group_id;
    IF v_t IS NULL THEN RAISE EXCEPTION 'social_ledger: group % not found', NEW.recipient_group_id; END IF;
    IF NEW.tenant_id <> v_t THEN
      RAISE EXCEPTION 'social_ledger: tenant mismatch (ledger %, recipient_group %)', NEW.tenant_id, v_t;
    END IF;
  END IF;

  IF NEW.owner_actor_id IS NOT NULL THEN
    SELECT tenant_id INTO v_t FROM actors WHERE actor_id = NEW.owner_actor_id;
    IF v_t IS NULL THEN RAISE EXCEPTION 'social_ledger: owner_actor % not found', NEW.owner_actor_id; END IF;
    IF NEW.tenant_id <> v_t THEN
      RAISE EXCEPTION 'social_ledger: tenant mismatch (ledger %, owner_actor %)', NEW.tenant_id, v_t;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Garantir trigger de consistência no INSERT (idempotente)
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


-- ============================================================
-- 6) RESTAURAR APPEND-ONLY (bloquear UPDATE/DELETE novamente)
-- ============================================================

-- Garantir função de bloqueio (se já existe do 052, OR REPLACE mantém compatível)
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
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_social_ledger_no_update') THEN
    CREATE TRIGGER trg_social_ledger_no_update
      BEFORE UPDATE ON social_ledger
      FOR EACH ROW
      EXECUTE FUNCTION social_ledger_block_mutations();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_social_ledger_no_delete') THEN
    CREATE TRIGGER trg_social_ledger_no_delete
      BEFORE DELETE ON social_ledger
      FOR EACH ROW
      EXECUTE FUNCTION social_ledger_block_mutations();
  END IF;
END $$;


-- ============================================================
-- 7) COMENTÁRIOS
-- ============================================================

COMMENT ON COLUMN social_ledger.amount_cents IS
  'Valor monetário em centavos (INTEGER) para evitar problemas de precisão';

COMMENT ON COLUMN social_ledger.idempotency_key IS
  'Chave de idempotência (tenant_id + idempotency_key único quando não NULL)';

COMMENT ON COLUMN social_ledger.owner_actor_id IS
  'Actor que originou o lançamento (rastreabilidade e hardening futuro; RLS pode evoluir)';


-- ============================================================
-- FIM 053_social_ledger_hardening.sql
-- ============================================================













