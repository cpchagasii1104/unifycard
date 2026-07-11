-- ============================================================
-- F-NEIGHBORHOOD-CANONICAL-IDENTITY / N2-D.2-R2 — COERENCIA TENANT x ACTORS NOS GRANTS ACTOR-SCOPED
-- Fecha a 2a (e ultima) ressalva da auditoria Yala da N2-D.2: as FKs sao actors(id) SEM tenant, entao
-- fn_grant/fn_revoke aceitavam Actor de OUTRO tenant (provado ao vivo no GATE R0). A barreira PRINCIPAL
-- vive DENTRO das funcoes SECURITY DEFINER (unificard_app tem EXECUTE nelas); o service e defesa
-- antecipada, nao a unica barreira.
-- ============================================================
-- INVARIANTE: para um grant actor-scoped com tenant T, TODOS os Actors usados pertencem a T —
--   grantee_actor_id, scope_actor_id, granted_by/executed_by_actor_id, responsible_human_actor_id.
--   Erro NAO-vazante: Actor inexistente e Actor de outro tenant falham IDENTICAMENTE (ACTOR_TENANT_MISMATCH).
--   Locking FOR SHARE em ordem deterministica de UUID (sem deadlock; sem TOCTOU).
-- ESCOPO: recria fn_grant (mesma assinatura) + helper interno + SUBSTITUI fn_revoke por assinatura com
--   p_expected_tenant_id (a antiga e DROPADA — nenhum overload inseguro permanece). fn_expire/fn_regrant
--   INTOCADAS. Tabelas/keys/matriz/lifecycle/reason INTOCADOS. Forward-only; transacao unica; fail-closed.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- FAIL-CLOSED (PRE): terreno esperado da N2-D.2 (+R1).
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_cnt BIGINT;
BEGIN
  IF to_regclass('public.actor_capability_grants') IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: actor_capability_grants ausente.'; END IF;
  IF to_regclass('public.actor_capability_grant_events') IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: eventos ausentes.'; END IF;
  -- zero grants/eventos vivos (nada a corrigir)
  SELECT count(*) INTO v_cnt FROM actor_capability_grants; IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % grant(s) vivo(s) — R2 nao corrige dados; STOP.', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM actor_capability_grant_events; IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % evento(s) vivo(s).', v_cnt; END IF;
  -- as 4 funcoes D.2 existem com as assinaturas registradas
  IF to_regprocedure('public.fn_grant_actor_capability(uuid,uuid,text,uuid,uuid,uuid,text,timestamptz,text,uuid,uuid,uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: fn_grant_actor_capability com assinatura D.2 ausente.'; END IF;
  IF to_regprocedure('public.fn_revoke_actor_capability_grant(uuid,uuid,uuid,uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: fn_revoke_actor_capability_grant (assinatura D.2 antiga) ausente — estado divergente.'; END IF;
  IF to_regprocedure('public.fn_expire_actor_capability_grant(uuid,uuid,uuid,uuid,text)') IS NULL
     OR to_regprocedure('public.fn_regrant_actor_capability(uuid,timestamptz,text,uuid,uuid,uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: fn_expire/fn_regrant ausentes.'; END IF;
  -- objetos R2 ainda nao existem
  IF to_regprocedure('public.fn_assert_actors_in_tenant(uuid,uuid[])') IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: fn_assert_actors_in_tenant ja existe — estado divergente.'; END IF;
  IF to_regprocedure('public.fn_revoke_actor_capability_grant(uuid,uuid,uuid,uuid,uuid,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: assinatura R2 de fn_revoke ja existe — estado divergente.'; END IF;
  -- actors: PK e (id) e existe tenant_id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.actors'::regclass AND contype='p' AND pg_get_constraintdef(oid)='PRIMARY KEY (id)') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: PK de actors nao e (id).'; END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. HELPER INTERNO — coerencia tenant de um conjunto de Actors. INTERNO: sem EXECUTE app/PUBLIC;
--    chamado somente pelas funcoes canonicas (que rodam como owner). Dedup + ordem deterministica de
--    UUID + lock FOR SHARE; erro NAO-vazante (foreign == nonexistent).
-- ────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION fn_assert_actors_in_tenant(p_tenant_id UUID, p_actor_ids UUID[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $func$
DECLARE
  v_ids UUID[];
  v_expected INT;
  v_found INT;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'ACTOR_TENANT_MISMATCH: tenant esperado nulo em grant actor-scoped.';
  END IF;
  -- dedup + ordem deterministica (evita deadlock por ordem variavel; IDs repetidos entre papeis nao inflam)
  SELECT array_agg(x ORDER BY x) INTO v_ids FROM (SELECT DISTINCT y AS x FROM unnest(p_actor_ids) AS y WHERE y IS NOT NULL) d;
  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'ACTOR_TENANT_MISMATCH: nenhum actor a validar.';
  END IF;
  v_expected := array_length(v_ids, 1);
  -- lock FOR SHARE dos actors do MESMO tenant, na ordem crescente de id (deterministica)
  PERFORM a.id FROM public.actors a
   WHERE a.tenant_id = p_tenant_id AND a.id = ANY(v_ids)
   ORDER BY a.id
   FOR SHARE;
  GET DIAGNOSTICS v_found = ROW_COUNT;
  IF v_found <> v_expected THEN
    -- NAO revela quais/porque (inexistente vs. outro tenant vs. outro tipo): mesmo erro estavel.
    RAISE EXCEPTION 'ACTOR_TENANT_MISMATCH: um ou mais actors nao pertencem ao tenant do grant.';
  END IF;
END;
$func$;

COMMENT ON FUNCTION fn_assert_actors_in_tenant(UUID, UUID[]) IS
  'N2-D.2-R2: valida que TODOS os actor ids pertencem a p_tenant_id (dedup + ordem deterministica + FOR SHARE). Erro NAO-vazante ACTOR_TENANT_MISMATCH. INTERNA — sem EXECUTE app/PUBLIC; chamada so pelas funcoes canonicas de grant.';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. FN_GRANT — recriada (mesma assinatura) com validacao tenant-aware ANTES do INSERT.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_grant_actor_capability(
  p_tenant_id                 UUID,
  p_grantee_actor_id           UUID,
  p_capability_key             TEXT,
  p_scope_actor_id             UUID,
  p_granted_by_user_id         UUID,
  p_granted_by_actor_id        UUID,
  p_authority_source           TEXT,
  p_valid_until                TIMESTAMPTZ,
  p_reason                     TEXT,
  p_executed_by_user_id        UUID,
  p_executed_by_actor_id       UUID,
  p_responsible_human_actor_id UUID,
  p_event_reason               TEXT
) RETURNS public.actor_capability_grants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $func$
DECLARE
  v_grant public.actor_capability_grants%ROWTYPE;
BEGIN
  -- N2-D.2-R2: coerencia tenant obrigatoria ANTES de qualquer INSERT (falha => zero grant/evento).
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'ACTOR_TENANT_MISMATCH: grant actor-scoped exige tenant_id nao nulo.';
  END IF;
  PERFORM public.fn_assert_actors_in_tenant(
    p_tenant_id,
    ARRAY[p_grantee_actor_id, p_scope_actor_id, p_granted_by_actor_id, p_executed_by_actor_id, p_responsible_human_actor_id]
  );

  INSERT INTO public.actor_capability_grants (
    tenant_id, grantee_actor_id, capability_key, scope_type, scope_actor_id, scope_city_id,
    granted_by_user_id, granted_by_actor_id, authority_source, status, valid_from, valid_until, reason
  ) VALUES (
    p_tenant_id, p_grantee_actor_id, p_capability_key, 'actor', p_scope_actor_id, NULL,
    p_granted_by_user_id, p_granted_by_actor_id, p_authority_source, 'active', now(), p_valid_until, p_reason
  ) RETURNING * INTO v_grant;

  INSERT INTO public.actor_capability_grant_events (
    grant_id, event_type, grantee_actor_id, capability_key, scope_type, tenant_id, scope_actor_id, scope_city_id,
    valid_from, valid_until, authority_source, executed_by_user_id, executed_by_actor_id, responsible_human_actor_id, event_reason
  ) VALUES (
    v_grant.grant_id, 'granted', v_grant.grantee_actor_id, v_grant.capability_key, v_grant.scope_type, v_grant.tenant_id,
    v_grant.scope_actor_id, v_grant.scope_city_id, v_grant.valid_from, v_grant.valid_until, v_grant.authority_source,
    p_executed_by_user_id, p_executed_by_actor_id, p_responsible_human_actor_id, p_event_reason
  );

  RETURN v_grant;
END;
$func$;

COMMENT ON FUNCTION fn_grant_actor_capability(UUID,UUID,TEXT,UUID,UUID,UUID,TEXT,TIMESTAMPTZ,TEXT,UUID,UUID,UUID,TEXT) IS
  'N2-D.2 + R2: cria grant actor-scoped (state+evento atomico). Valida coerencia tenant (grantee/scope/granted_by/executed_by/responsible_human ∈ p_tenant_id) ANTES do INSERT via fn_assert_actors_in_tenant. PUBLICA — EXECUTE unificard_app. scope_type=actor fixo; sem scope_city_id do chamador.';

-- ────────────────────────────────────────────────────────────────────────────
-- 3. FN_REVOKE — assinatura ANTIGA DROPADA; nova exige p_expected_tenant_id (barreira no banco).
-- ────────────────────────────────────────────────────────────────────────────
DROP FUNCTION fn_revoke_actor_capability_grant(UUID,UUID,UUID,UUID,TEXT);

CREATE FUNCTION fn_revoke_actor_capability_grant(
  p_expected_tenant_id         UUID,
  p_grant_id                   UUID,
  p_executed_by_user_id        UUID,
  p_executed_by_actor_id       UUID,
  p_responsible_human_actor_id UUID,
  p_revoke_reason               TEXT
) RETURNS public.actor_capability_grants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $func$
DECLARE
  v_grant public.actor_capability_grants%ROWTYPE;
BEGIN
  IF p_expected_tenant_id IS NULL THEN
    RAISE EXCEPTION 'ACTOR_TENANT_MISMATCH: revoke actor-scoped exige tenant esperado nao nulo.';
  END IF;
  SELECT * INTO v_grant FROM public.actor_capability_grants WHERE grant_id = p_grant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTOR_CAPABILITY_GRANT_NOT_FOUND: grant % nao existe.', p_grant_id;
  END IF;
  -- scope antes do tenant: territory rejeita por scope; actor de OUTRO tenant vira NOT_FOUND (nao vaza).
  IF v_grant.scope_type <> 'actor' THEN
    RAISE EXCEPTION 'ACTOR_CAPABILITY_GRANT_REVOKE_SCOPE_MISMATCH: revoke canonico e actor-only (grant % e %).', p_grant_id, v_grant.scope_type;
  END IF;
  IF v_grant.tenant_id IS DISTINCT FROM p_expected_tenant_id THEN
    RAISE EXCEPTION 'ACTOR_CAPABILITY_GRANT_NOT_FOUND: grant % nao existe.', p_grant_id;
  END IF;
  IF v_grant.status <> 'active' THEN
    RAISE EXCEPTION 'ACTOR_CAPABILITY_GRANT_NOT_ACTIVE: grant % nao esta active (status atual: %).', p_grant_id, v_grant.status;
  END IF;
  -- coerencia tenant dos actors armazenados + executor + responsible human (mesmo tenant do grant).
  PERFORM public.fn_assert_actors_in_tenant(
    p_expected_tenant_id,
    ARRAY[v_grant.grantee_actor_id, v_grant.scope_actor_id, p_executed_by_actor_id, p_responsible_human_actor_id]
  );

  UPDATE public.actor_capability_grants
     SET status = 'revoked', revoked_at = now(), revoked_by_actor_id = p_executed_by_actor_id,
         revoke_reason = p_revoke_reason, updated_at = now()
   WHERE grant_id = p_grant_id
  RETURNING * INTO v_grant;

  INSERT INTO public.actor_capability_grant_events (
    grant_id, event_type, grantee_actor_id, capability_key, scope_type, tenant_id, scope_actor_id, scope_city_id,
    valid_from, valid_until, authority_source, executed_by_user_id, executed_by_actor_id, responsible_human_actor_id, event_reason
  ) VALUES (
    v_grant.grant_id, 'revoked', v_grant.grantee_actor_id, v_grant.capability_key, v_grant.scope_type, v_grant.tenant_id,
    v_grant.scope_actor_id, v_grant.scope_city_id, v_grant.valid_from, v_grant.valid_until, v_grant.authority_source,
    p_executed_by_user_id, p_executed_by_actor_id, p_responsible_human_actor_id, p_revoke_reason
  );

  RETURN v_grant;
END;
$func$;

COMMENT ON FUNCTION fn_revoke_actor_capability_grant(UUID,UUID,UUID,UUID,UUID,TEXT) IS
  'N2-D.2 + R2: revoga grant actor-scoped (state+evento atomico). Exige p_expected_tenant_id = grant.tenant_id (cross-tenant => NOT_FOUND nao-vazante; territory => scope mismatch). Valida grantee/scope/executor/responsible_human ∈ tenant. reason da concessao NUNCA alterado. Assinatura antiga (sem tenant) DROPADA.';

-- ────────────────────────────────────────────────────────────────────────────
-- 4. ACL / EXECUTE por assinatura.
-- ────────────────────────────────────────────────────────────────────────────
-- helper interno: sem EXECUTE app/PUBLIC (roda no contexto definer das canonicas).
REVOKE EXECUTE ON FUNCTION fn_assert_actors_in_tenant(UUID, UUID[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_assert_actors_in_tenant(UUID, UUID[]) FROM unificard_app;
-- nova fn_revoke: publica p/ app; PUBLIC sem EXECUTE. (o default privilege de schema auto-concede a app;
-- confirmamos e mantemos.)
REVOKE EXECUTE ON FUNCTION fn_revoke_actor_capability_grant(UUID,UUID,UUID,UUID,UUID,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_revoke_actor_capability_grant(UUID,UUID,UUID,UUID,UUID,TEXT) TO unificard_app;
-- fn_grant (CREATE OR REPLACE preserva ACL existente: postgres + unificard_app). Reafirmar PUBLIC sem EXECUTE.
REVOKE EXECUTE ON FUNCTION fn_grant_actor_capability(UUID,UUID,TEXT,UUID,UUID,UUID,TEXT,TIMESTAMPTZ,TEXT,UUID,UUID,UUID,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_grant_actor_capability(UUID,UUID,TEXT,UUID,UUID,UUID,TEXT,TIMESTAMPTZ,TEXT,UUID,UUID,UUID,TEXT) TO unificard_app;

-- ────────────────────────────────────────────────────────────────────────────
-- FAIL-CLOSED (POS): prova assinaturas, ausencia de overload inseguro, ACL, fn_expire/regrant intactas.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_cnt BIGINT; v_src TEXT;
BEGIN
  -- helper existe, SECURITY DEFINER, owner postgres
  IF to_regprocedure('public.fn_assert_actors_in_tenant(uuid,uuid[])') IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: fn_assert_actors_in_tenant ausente.'; END IF;
  SELECT count(*) INTO v_cnt FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
   WHERE p.proname='fn_assert_actors_in_tenant' AND r.rolname='postgres' AND p.prosecdef;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'MIGRATION_ABORT: helper nao SECURITY DEFINER/owner postgres.'; END IF;

  -- fn_grant chama o helper (coerencia tenant)
  SELECT pg_get_functiondef(to_regprocedure('public.fn_grant_actor_capability(uuid,uuid,text,uuid,uuid,uuid,text,timestamptz,text,uuid,uuid,uuid,text)')) INTO v_src;
  IF v_src !~ 'fn_assert_actors_in_tenant' THEN RAISE EXCEPTION 'MIGRATION_ABORT: fn_grant nao valida coerencia tenant.'; END IF;

  -- assinatura ANTIGA de revoke NAO existe mais (sem overload inseguro); nova existe e chama o helper
  IF to_regprocedure('public.fn_revoke_actor_capability_grant(uuid,uuid,uuid,uuid,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: overload antigo de fn_revoke (sem tenant) ainda existe.'; END IF;
  IF to_regprocedure('public.fn_revoke_actor_capability_grant(uuid,uuid,uuid,uuid,uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: nova fn_revoke (com tenant) ausente.'; END IF;
  SELECT count(*) INTO v_cnt FROM pg_proc WHERE proname='fn_revoke_actor_capability_grant';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'MIGRATION_ABORT: existe mais de uma fn_revoke (overload).'; END IF;
  SELECT pg_get_functiondef(to_regprocedure('public.fn_revoke_actor_capability_grant(uuid,uuid,uuid,uuid,uuid,text)')) INTO v_src;
  IF v_src !~ 'fn_assert_actors_in_tenant' OR v_src !~ 'p_expected_tenant_id' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: nova fn_revoke nao valida tenant esperado/coerencia de actors.'; END IF;

  -- EXECUTE: helper sem app/PUBLIC; grant/revoke com app, sem PUBLIC.
  SELECT count(*) INTO v_cnt FROM information_schema.role_routine_grants
   WHERE routine_name='fn_assert_actors_in_tenant' AND grantee IN ('unificard_app','PUBLIC');
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: helper tem EXECUTE app/PUBLIC.'; END IF;
  SELECT count(*) INTO v_cnt FROM information_schema.role_routine_grants
   WHERE routine_name IN ('fn_grant_actor_capability','fn_revoke_actor_capability_grant') AND grantee='unificard_app';
  IF v_cnt <> 2 THEN RAISE EXCEPTION 'MIGRATION_ABORT: EXECUTE de app em grant/revoke divergente (% de 2).', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM information_schema.role_routine_grants
   WHERE routine_name IN ('fn_grant_actor_capability','fn_revoke_actor_capability_grant','fn_assert_actors_in_tenant') AND grantee='PUBLIC';
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: PUBLIC tem EXECUTE em grant/revoke/helper.'; END IF;

  -- fn_expire/fn_regrant INTOCADAS (assinatura + ACL app/PUBLIC ausentes)
  SELECT count(*) INTO v_cnt FROM information_schema.role_routine_grants
   WHERE routine_name IN ('fn_expire_actor_capability_grant','fn_regrant_actor_capability') AND grantee IN ('unificard_app','PUBLIC');
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: fn_expire/fn_regrant ganharam EXECUTE app/PUBLIC.'; END IF;
  IF to_regprocedure('public.fn_expire_actor_capability_grant(uuid,uuid,uuid,uuid,text)') IS NULL
     OR to_regprocedure('public.fn_regrant_actor_capability(uuid,timestamptz,text,uuid,uuid,uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: fn_expire/fn_regrant assinaturas alteradas.'; END IF;

  -- zero grants/eventos (nada seedado)
  SELECT count(*) INTO v_cnt FROM actor_capability_grants; IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: grant real criado.'; END IF;
  SELECT count(*) INTO v_cnt FROM actor_capability_grant_events; IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: evento real criado.'; END IF;
END $$;

COMMIT;
