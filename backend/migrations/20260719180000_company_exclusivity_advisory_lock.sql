-- ============================================================
-- F-COMPANY-ACCESS-AUTHORITY-YALA-CLOSEOUT · ETAPA C — EXCLUSIVIDADE SOB CONCORRÊNCIA REAL
-- (DECISION-0189A §4 / D5-D6 — Finding C da YALA: WRITE-SKEW)
--
-- PROBLEMA: os dois constraint triggers (F4) liam a tabela OPOSTA sem serialização — sob
-- READ COMMITTED, T1 (membership→active) e T2 (delegação empresarial→active) podiam AMBAS
-- passar no check pré-commit e commitar a violação (write-skew). O fechamento era só sequencial.
--
-- CORREÇÃO (D6): função SQL auxiliar ÚNICA produz a chave advisory determinística da RELAÇÃO
-- (tenant_id × company_id × global_user_id); AMBOS os trigger functions adquirem
-- pg_advisory_xact_lock(chave) ANTES do SELECT cross-table e reexecutam a consulta DEPOIS do
-- lock (o SELECT dentro do trigger enxerga o snapshot do comando + linhas commitadas pela
-- transação concorrente que segurou o lock antes — a segunda transação SEMPRE vê a primeira).
--   • transaction-level (xact), NUNCA session;
--   • escopo: SOMENTE relações empresariais (grupo/canal/regional_treasury INTOCADOS —
--     retorno precoce sem lock);
--   • colisão de hash pode serializar relação não relacionada — aceito; NUNCA permite violação;
--   • relação declaradamente empresarial sem company/identity resolvível → FAIL-CLOSED;
--   • erro de domínio útil sem vazar dados de outro tenant.
--
-- FORWARD-ONLY · TRANSACIONAL · HARD-FAIL · Δbank=0.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_actor_delegations_company_exclusivity')
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_company_users_delegation_exclusivity') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: triggers de exclusividade da F4 ausentes.';
  END IF;
  IF to_regprocedure('public.fn_company_relation_advisory_lock(uuid,uuid,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: fn_company_relation_advisory_lock já existe — estado divergente.';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. FUNÇÃO AUXILIAR ÚNICA da chave (D6: evita algoritmos divergentes nos dois lados).
--    Representação canônica NÃO-ambígua: uuids em texto lower, separador fixo ':'.
--    hashtextextended → bigint (espaço de 64 bits; colisão = serialização inócua).
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_company_relation_advisory_lock(
  p_tenant_id UUID,
  p_company_id UUID,
  p_global_user_id UUID
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_tenant_id IS NULL OR p_company_id IS NULL OR p_global_user_id IS NULL THEN
    -- relação declaradamente empresarial sem identidade resolvível → FAIL-CLOSED (D6.7)
    RAISE EXCEPTION 'EXCLUSIVITY_LOCK_UNRESOLVED_RELATION: relação empresarial sem tenant/company/identity resolvíveis (DECISION-0189A §4)';
  END IF;
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'company-relation:' || lower(p_tenant_id::text) || ':' || lower(p_company_id::text) || ':' || lower(p_global_user_id::text),
      0
    )
  );
END;
$$;

COMMENT ON FUNCTION fn_company_relation_advisory_lock(UUID, UUID, UUID) IS
'DECISION-0189A §4 (D6): chave advisory determinística da relação empresarial tenant×company×identity. AMBOS os triggers de exclusividade a adquirem (xact-level) ANTES do check cross-table — mata o write-skew do Finding C.';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. TRIGGER FUNCTION lado DELEGAÇÕES — lock ANTES do check, check reexecutado após o lock
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_company_membership_delegation_exclusivity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id UUID;
  v_global_user_id UUID;
  v_conflict BIGINT;
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
    -- delegação para EMPRESA cujo user actor não resolve Identity → FAIL-CLOSED (D6.7):
    -- sem identidade não há como provar exclusividade; relação empresarial não prossegue.
    RAISE EXCEPTION 'EXCLUSIVITY_UNRESOLVED_IDENTITY: delegação empresarial sem Identity resolvível do user actor (DECISION-0189A §4)';
  END IF;

  -- 🔒 D6: LOCK da relação ANTES do check cross-table (serializa contra o lado membership)
  PERFORM fn_company_relation_advisory_lock(NEW.tenant_id, v_company_id, v_global_user_id);

  -- check REEXECUTADO após o lock: a transação concorrente que commitou segurando o lock
  -- antes é VISÍVEL aqui (snapshot do comando interno do trigger).
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
-- 3. TRIGGER FUNCTION lado COMPANY_USERS — MESMA chave, mesma ordem
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_company_users_delegation_exclusivity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE v_conflict BIGINT;
BEGIN
  IF NEW.member_status <> 'active' THEN
    RETURN NEW;
  END IF;
  -- linha de company_users é SEMPRE relação empresarial: tenant/company/identity vêm da própria
  -- linha (NOT NULL por schema) — fail-closed estrutural da D6.7 coberto pelas constraints.

  -- 🔒 D6: LOCK da relação ANTES do check cross-table (mesma chave do lado delegações)
  PERFORM fn_company_relation_advisory_lock(NEW.tenant_id, NEW.company_id, NEW.global_user_id);

  -- check REEXECUTADO após o lock
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

-- POSTCHECK: triggers seguem apontando para as funções (CREATE OR REPLACE preserva o binding)
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
  IF to_regprocedure('public.fn_company_relation_advisory_lock(uuid,uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: função de lock ausente.';
  END IF;
END $$;

COMMIT;
