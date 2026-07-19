-- ============================================================
-- DECISION-0189B D8 — ISOLAMENTO FAIL-CLOSED da exclusividade membership×delegação
--
-- PROBLEMA: o fechamento por advisory lock + RECHECK (migration 20260719180000) só é correto
-- sob READ COMMITTED — lá cada statement do plpgsql pega um snapshot NOVO, então o recheck após
-- o lock enxerga a linha commitada pela transação concorrente. Sob REPEATABLE READ o snapshot da
-- TRANSAÇÃO é congelado no início: o recheck NÃO vê o commit concorrente e, SEM SSI, a violação
-- passa silenciosamente (write-skew). Sob SERIALIZABLE o snapshot também é congelado, MAS o SSI
-- detecta a dependência rw e ABORTA uma das transações no commit (serialization_failure) — seguro.
--
-- CORREÇÃO (D8): ambos os trigger functions checam `current_setting('transaction_isolation')`
-- ANTES de adquirir o lock:
--   • read committed → prossegue (lock + recheck lineariza);
--   • serializable   → prossegue (SSI aborta uma no commit; aceitamos serialization_failure);
--   • repeatable read→ RAISE fail-closed (snapshot congelado sem SSI não garante exclusividade);
--   • desconhecido/não suportado → RAISE fail-closed.
--
-- FORWARD-ONLY · TRANSACIONAL · HARD-FAIL · preserva a função de lock e os triggers · Δbank=0.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.fn_company_relation_advisory_lock(uuid,uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: fn_company_relation_advisory_lock ausente (pré-requisito 20260719180000).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_actor_delegations_company_exclusivity')
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_company_users_delegation_exclusivity') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: triggers de exclusividade ausentes.';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- lado DELEGAÇÕES — guarda de isolamento ANTES do lock
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_company_membership_delegation_exclusivity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id UUID;
  v_global_user_id UUID;
  v_conflict BIGINT;
  v_iso TEXT;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;
  SELECT a.company_id INTO v_company_id
    FROM actors a
   WHERE a.tenant_id = NEW.tenant_id AND a.id = NEW.institutional_actor_id;
  IF v_company_id IS NULL THEN
    RETURN NEW; -- grupo/canal/evento — fora do escopo empresarial (sem lock; INTOCADO)
  END IF;
  SELECT u.global_user_id INTO v_global_user_id
    FROM actors ua
    JOIN users u ON u.user_id = ua.user_id AND u.tenant_id = ua.tenant_id
   WHERE ua.tenant_id = NEW.tenant_id AND ua.id = NEW.user_actor_id;
  IF v_global_user_id IS NULL THEN
    RAISE EXCEPTION 'EXCLUSIVITY_UNRESOLVED_IDENTITY: delegação empresarial sem Identity resolvível do user actor (DECISION-0189A §4)';
  END IF;

  -- 🔒 D8: só prosseguimos em níveis de isolamento que GARANTEM a exclusividade.
  v_iso := current_setting('transaction_isolation');
  IF v_iso = 'repeatable read' THEN
    RAISE EXCEPTION 'EXCLUSIVITY_UNSAFE_ISOLATION: REPEATABLE READ não garante a exclusividade (snapshot congelado sem SSI; recheck não vê o commit concorrente) — fail-closed (DECISION-0189B D8)';
  ELSIF v_iso NOT IN ('read committed', 'serializable') THEN
    RAISE EXCEPTION 'EXCLUSIVITY_UNKNOWN_ISOLATION: nível de isolamento "%" não suportado para exclusividade — fail-closed (DECISION-0189B D8)', v_iso;
  END IF;

  -- 🔒 D6: LOCK da relação ANTES do check cross-table (serializa contra o lado membership)
  PERFORM fn_company_relation_advisory_lock(NEW.tenant_id, v_company_id, v_global_user_id);

  SELECT COUNT(*) INTO v_conflict
    FROM company_users cu
   WHERE cu.tenant_id = NEW.tenant_id AND cu.company_id = v_company_id
     AND cu.global_user_id = v_global_user_id AND cu.member_status = 'active';
  IF v_conflict > 0 THEN
    RAISE EXCEPTION 'EXCLUSIVITY_VIOLATION: Identity com membership ATIVA na empresa % não pode receber delegação empresarial ativa para a MESMA relação (DECISION-0189 §6.3)', v_company_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- lado COMPANY_USERS — MESMA guarda, mesma ordem
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_company_users_delegation_exclusivity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_conflict BIGINT;
  v_iso TEXT;
BEGIN
  IF NEW.member_status <> 'active' THEN
    RETURN NEW;
  END IF;

  -- 🔒 D8: guarda de isolamento antes do lock (mesma política do lado delegações)
  v_iso := current_setting('transaction_isolation');
  IF v_iso = 'repeatable read' THEN
    RAISE EXCEPTION 'EXCLUSIVITY_UNSAFE_ISOLATION: REPEATABLE READ não garante a exclusividade (snapshot congelado sem SSI; recheck não vê o commit concorrente) — fail-closed (DECISION-0189B D8)';
  ELSIF v_iso NOT IN ('read committed', 'serializable') THEN
    RAISE EXCEPTION 'EXCLUSIVITY_UNKNOWN_ISOLATION: nível de isolamento "%" não suportado para exclusividade — fail-closed (DECISION-0189B D8)', v_iso;
  END IF;

  -- 🔒 D6: LOCK da relação ANTES do check cross-table (mesma chave do lado delegações)
  PERFORM fn_company_relation_advisory_lock(NEW.tenant_id, NEW.company_id, NEW.global_user_id);

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

-- POSTCHECK: bindings preservados + ambas as funções carregam a guarda de isolamento
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
                  WHERE t.tgname='trg_actor_delegations_company_exclusivity'
                    AND p.proname='fn_company_membership_delegation_exclusivity') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: trigger delegations desvinculado da função.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
                  WHERE t.tgname='trg_company_users_delegation_exclusivity'
                    AND p.proname='fn_company_users_delegation_exclusivity') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: trigger company_users desvinculado da função.';
  END IF;
  IF (SELECT prosrc FROM pg_proc WHERE proname='fn_company_membership_delegation_exclusivity') NOT LIKE '%EXCLUSIVITY_UNSAFE_ISOLATION%'
     OR (SELECT prosrc FROM pg_proc WHERE proname='fn_company_users_delegation_exclusivity') NOT LIKE '%EXCLUSIVITY_UNSAFE_ISOLATION%' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: guarda de isolamento ausente em alguma trigger function.';
  END IF;
END $$;

COMMIT;
