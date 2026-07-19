-- ============================================================
-- F-COMPANY-ACCESS-AUTHORITY-FOUNDATION · F4 — LIFECYCLE E CUTOVER EMPRESARIAL (DECISION-0189)
--
-- O QUE FAZ:
--   1. ENCERRA (revoke LÓGICO + eventos causais, SEM DELETE) as delegações de MEMBERSHIP
--      empresarial ainda ativas — pares (user actor ↔ page actor de empresa) cuja Identity
--      tem membership ATIVA na mesma empresa. Representantes EXTERNOS (sem membership),
--      grupos e canais: INTOCADOS (guard escopado — §6.2).
--   2. 'invited' MORRE como estado de membership (R17): CHECK member_status →
--      {active, suspended, revoked}. Preflight FALHA se existir linha 'invited' inesperada
--      (nunca descartar convite real silenciosamente).
--   3. DROP COLUMN company_users.is_active — denominador fechado: catálogo do banco varrido
--      (views/matviews/functions/índices/constraints/policies = ZERO dependências; único
--      trigger é updated_at) e runtime migrado para member_status (F3/F4).
--   4. ATIVA a exclusividade membership×delegação POR RELAÇÃO (R12) nas DUAS direções:
--      constraint trigger em actor_delegations (F2 criou a função) + trigger espelho em
--      company_users (membership virando active com delegação empresarial ativa → ABORT).
--
-- FORWARD-ONLY · TRANSACIONAL · HARD-FAIL · Δbank=0 (nenhuma tabela bank_* tocada).
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- PREFLIGHT FAIL-CLOSED
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_invited BIGINT;
BEGIN
  -- F2 aplicada
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='company_users' AND column_name='can_view_financial') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: F2 (20260719120000) não aplicada — colunas DECISION-0189 ausentes.';
  END IF;
  IF to_regclass('public.company_member_events') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: company_member_events ausente (F2 não aplicada).';
  END IF;
  IF to_regprocedure('public.fn_company_membership_delegation_exclusivity()') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: fn_company_membership_delegation_exclusivity ausente (F2).';
  END IF;
  -- is_active ainda existe (senão estado divergente)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='company_users' AND column_name='is_active') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: company_users.is_active já ausente — estado divergente.';
  END IF;
  -- coerência residual is_active × member_status (nenhuma divergência silenciosa a descartar)
  IF EXISTS (SELECT 1 FROM company_users WHERE is_active <> (member_status = 'active')) THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: divergência is_active × member_status — reconciliar explicitamente antes do DROP.';
  END IF;
  -- 'invited' precisa ser ZERO (convite real nunca é descartado em silêncio)
  SELECT COUNT(*) INTO v_invited FROM company_users WHERE member_status = 'invited';
  IF v_invited > 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: % linhas member_status=invited — migrar/decidir governadamente antes (R17).', v_invited;
  END IF;
  -- triggers de exclusividade ainda não existem
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname IN ('trg_actor_delegations_company_exclusivity','trg_company_users_delegation_exclusivity')) THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: trigger de exclusividade já existe — estado divergente.';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. CUTOVER: encerra delegações de MEMBERSHIP empresarial vivas (revoke lógico + eventos)
--    Escopo ESTRITO: institutional actor É empresa E a Identity do user actor tem membership
--    ATIVA na MESMA empresa. Representante externo (sem membership) NÃO é tocado.
-- ────────────────────────────────────────────────────────────────────────────
WITH membership_delegations AS (
  SELECT ad.delegation_id, ad.tenant_id, ad.relationship_type, ad.scopes_json,
         cu.id AS company_user_id, cu.company_id
    FROM actor_delegations ad
    JOIN actors pa ON pa.tenant_id = ad.tenant_id AND pa.id = ad.institutional_actor_id AND pa.company_id IS NOT NULL
    JOIN actors ua ON ua.tenant_id = ad.tenant_id AND ua.id = ad.user_actor_id
    JOIN users u   ON u.user_id = ua.user_id AND u.tenant_id = ua.tenant_id
    JOIN company_users cu ON cu.tenant_id = ad.tenant_id AND cu.company_id = pa.company_id
                         AND cu.global_user_id = u.global_user_id AND cu.member_status = 'active'
   WHERE ad.status = 'active'
), revoked AS (
  UPDATE actor_delegations ad
     SET status = 'revoked', revoked_at = NOW(), updated_at = NOW()
    FROM membership_delegations md
   WHERE ad.tenant_id = md.tenant_id AND ad.delegation_id = md.delegation_id
   RETURNING ad.delegation_id, ad.tenant_id, md.relationship_type, md.scopes_json, md.company_user_id, md.company_id
), deleg_events AS (
  INSERT INTO actor_delegation_events (tenant_id, delegation_id, event_type, actor_id, relationship_type, scopes_json, reason)
  SELECT r.tenant_id, r.delegation_id, 'revoked', NULL, r.relationship_type, r.scopes_json, 'membership_cutover_0189'
    FROM revoked r
  RETURNING 1
)
INSERT INTO company_member_events (tenant_id, company_id, company_user_id, event_type, snapshot, details)
SELECT r.tenant_id, r.company_id, r.company_user_id, 'delegation_cutover',
       jsonb_build_object('delegation_id', r.delegation_id, 'relationship_type', r.relationship_type, 'scopes', r.scopes_json),
       jsonb_build_object('reason', 'membership_cutover_0189',
                          'note', 'autoridade de membership migrou para company_users.can_* + company_member_relationships')
  FROM revoked r;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. 'invited' morre no CHECK (preflight garantiu zero linhas)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE company_users DROP CONSTRAINT chk_company_users_member_status_valid;
ALTER TABLE company_users ADD CONSTRAINT chk_company_users_member_status_valid
  CHECK (member_status IN ('active', 'suspended', 'revoked'));

-- ────────────────────────────────────────────────────────────────────────────
-- 3. DROP is_active (denominador fechado — catálogo varrido + runtime migrado)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE company_users DROP COLUMN is_active;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. EXCLUSIVIDADE POR RELAÇÃO — ATIVA nas duas direções (R12; tenant-safe; ESCOPADA a empresa)
-- ────────────────────────────────────────────────────────────────────────────
CREATE CONSTRAINT TRIGGER trg_actor_delegations_company_exclusivity
  AFTER INSERT OR UPDATE OF status ON actor_delegations
  FOR EACH ROW EXECUTE FUNCTION fn_company_membership_delegation_exclusivity();

CREATE OR REPLACE FUNCTION fn_company_users_delegation_exclusivity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE v_conflict BIGINT;
BEGIN
  -- membership virando/ficando ACTIVE não pode coexistir com delegação empresarial ATIVA
  -- da MESMA Identity para a MESMA empresa (DECISION-0189 §6.3).
  IF NEW.member_status <> 'active' THEN
    RETURN NEW;
  END IF;
  SELECT COUNT(*) INTO v_conflict
    FROM actor_delegations ad
    JOIN actors pa ON pa.tenant_id = ad.tenant_id AND pa.id = ad.institutional_actor_id
    JOIN actors ua ON ua.tenant_id = ad.tenant_id AND ua.id = ad.user_actor_id
    JOIN users u   ON u.user_id = ua.user_id AND u.tenant_id = ua.tenant_id
   WHERE ad.tenant_id = NEW.tenant_id AND ad.status = 'active'
     AND pa.company_id = NEW.company_id
     AND u.global_user_id = NEW.global_user_id;
  IF v_conflict > 0 THEN
    RAISE EXCEPTION 'EXCLUSIVITY_VIOLATION: Identity com delegação empresarial ATIVA para a empresa % não pode ter membership active na MESMA relação (DECISION-0189 §6.3)', NEW.company_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_company_users_delegation_exclusivity
  AFTER INSERT OR UPDATE OF member_status ON company_users
  FOR EACH ROW EXECUTE FUNCTION fn_company_users_delegation_exclusivity();

-- ────────────────────────────────────────────────────────────────────────────
-- POSTCHECKS
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_cnt BIGINT;
BEGIN
  -- nenhuma delegação de membership empresarial viva
  SELECT COUNT(*) INTO v_cnt
    FROM actor_delegations ad
    JOIN actors pa ON pa.tenant_id = ad.tenant_id AND pa.id = ad.institutional_actor_id AND pa.company_id IS NOT NULL
    JOIN actors ua ON ua.tenant_id = ad.tenant_id AND ua.id = ad.user_actor_id
    JOIN users u   ON u.user_id = ua.user_id AND u.tenant_id = ua.tenant_id
    JOIN company_users cu ON cu.tenant_id = ad.tenant_id AND cu.company_id = pa.company_id
                         AND cu.global_user_id = u.global_user_id AND cu.member_status = 'active'
   WHERE ad.status = 'active';
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: % delegações de membership seguem ativas após cutover.', v_cnt;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='company_users' AND column_name='is_active') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: is_active sobreviveu ao DROP.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_actor_delegations_company_exclusivity')
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_company_users_delegation_exclusivity') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: triggers de exclusividade não ativados.';
  END IF;
END $$;

COMMIT;
