-- ============================================================
-- F-NEIGHBORHOOD-CANONICAL-IDENTITY / N2-D.3 — RESOLVER/ASSERTION DE CAPABILITY TERRITORIAL
-- DECISION-0173 (§4/§5 keys+authority) + ADENDO N2-D.3 (D1..D8 ratificados por Clayton).
-- ============================================================
-- CRIA o PRIMITIVO SQL CANONICO que valida e TRAVA (FOR SHARE) o grant territorial de um Actor para uma
-- capability territorial exata numa cidade canonica exata. REUTILIZA integralmente a casa canonica
-- actor_capability_grants (N2-D.1/D.2/R2) — NUNCA segunda casa/segunda verdade de autoridade.
--
-- D1 (composicao tenant x territorio): grant territorial e GLOBAL por cidade (tenant_id NULL,
--   scope_type='territory', scope_city_id NOT NULL, grantee_actor_id tenant-bound). A REPRESENTABILIDADE
--   humana (canRepresentActor, tenant server-side) compoe a autoridade no RUNTIME TS — NAO nesta funcao.
--   Esta funcao NUNCA filtra por tenant no grant (grant global); exige apenas que o grantee Actor exista e
--   seja tenant-bound. Proibido: `tenant_id =`, `OR tenant_id IS NULL`, COALESCE de tenant, tenant do caller.
-- D2 (primitivo SQL agora): a funcao e ATOMICA PARA A ROW DO GRANT (FOR SHARE ate o fim da transacao
--   chamadora) + trava a row do grantee Actor (FK grantee_actor_id e ON DELETE CASCADE → sem o lock, o
--   Actor poderia ser deletado e cascatear o grant sob os pes de um futuro writer). NAO reivindica
--   atomicidade completa da representabilidade humana (isso compoe no TS; enforcement transacional
--   representacao+capability+writer sera envelope proprio da N2-E).
-- D3 (superficie): funcao interna + wrapper TS interno; ZERO rota; ZERO grant real.
-- D4 (SSOT lifecycle): a ROW de actor_capability_grants e a verdade operacional; a funcao NAO consulta
--   actor_capability_grant_events como segunda autoridade de lifecycle. Triggers/invariantes selados intactos.
-- D6: nenhum writer territorial nesta fase (guard proibe qualquer writer territorial, mesmo que chame o resolver).
--
-- ESCOPO NEGATIVO: ZERO funcao de grant/revoke territorial; ZERO rota; ZERO tabela; ZERO key/matriz/status
-- novos; ZERO seed/grant/evento; ZERO cache; ZERO evento de utilizacao; canRepresentActor INTOCADO;
-- fn_expire/fn_regrant INTOCADAS; matriz/keys seladas INTOCADAS; Social/Bank FORA. Forward-only; 1 transacao.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- FAIL-CLOSED (PRE): aborta se o terreno nao for exatamente o esperado.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_cnt BIGINT;
BEGIN
  IF to_regclass('public.actor_capability_grants') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: actor_capability_grants ausente — casa canonica e pre-requisito.';
  END IF;
  -- shape N2-D.1/D.2 intacto (pre-requisito): 5 constraints estruturais
  SELECT count(*) INTO v_cnt FROM pg_constraint WHERE conrelid='public.actor_capability_grants'::regclass
   AND conname IN ('chk_acg_scope_shape','chk_acg_territory_not_suspended','fk_acg_scope_city',
                   'chk_acg_scope_type','chk_acg_scope_capability_matrix');
  IF v_cnt <> 5 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: shape N2-D.1/D.2 incompleto/divergente (achado % de 5).', v_cnt;
  END IF;
  -- indice territorial ativo presente (unicidade que garante <=1 ativo por grantee/key/city)
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
                  AND indexname='uidx_actor_capability_grants_territory_active') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: uidx_actor_capability_grants_territory_active ausente.';
  END IF;
  -- funcoes canonicas D.2/R2 presentes e intocadas (nao recriamos nenhuma aqui)
  SELECT count(*) INTO v_cnt FROM pg_proc WHERE pronamespace='public'::regnamespace
   AND proname IN ('fn_grant_actor_capability','fn_revoke_actor_capability_grant',
                   'fn_expire_actor_capability_grant','fn_regrant_actor_capability','fn_assert_actors_in_tenant');
  IF v_cnt <> 5 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: funcoes canonicas D.2/R2 incompletas (achado % de 5).', v_cnt;
  END IF;
  -- resolver ainda NAO existe (idempotencia contra reaplicacao com estado divergente)
  IF to_regprocedure('public.fn_assert_territorial_capability(uuid,text,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: fn_assert_territorial_capability ja existe — estado divergente.';
  END IF;
  -- role de runtime presente (destino do EXECUTE)
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='unificard_app') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: role unificard_app ausente.';
  END IF;
  -- zero grant territorial vivo (a fatia nao semeia; nada a corrigir)
  SELECT count(*) INTO v_cnt FROM actor_capability_grants WHERE scope_type='territory';
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: % grant(s) territorial(is) vivo(s) — STOP (nao previsto).', v_cnt;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- FUNCAO CANONICA: assertion + lock do grant territorial. RETURNS o grant_id aprovado.
-- Qualquer negacao → RAISE EXCEPTION 'TERRITORIAL_CAPABILITY_DENIED' (uniforme, NAO-vazante: nunca
-- interpola Actor/tenant/city/key/grant_id/status/reason/datas/existencia alternativa).
-- ────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION fn_assert_territorial_capability(
  p_grantee_actor_id UUID,
  p_capability_key   TEXT,
  p_scope_city_id    UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $func$
DECLARE
  v_grant_id UUID;
  v_cnt      INT := 0;
  v_row      RECORD;
BEGIN
  -- (1) entradas obrigatorias nao-nulas → DENY uniforme.
  IF p_grantee_actor_id IS NULL OR p_capability_key IS NULL OR p_scope_city_id IS NULL THEN
    RAISE EXCEPTION 'TERRITORIAL_CAPABILITY_DENIED';
  END IF;

  -- (2) capability key TERRITORIAL EXATA — conjunto fechado, espelho da matriz selada. Match exato por
  --     igualdade (sem prefixo/wildcard); nunca key actor-scoped; nunca setima key; nunca fallback role/admin.
  IF p_capability_key NOT IN (
    'territory:create_neighborhood',
    'territory:approve_neighborhood',
    'territory:correct_neighborhood',
    'territory:deactivate_neighborhood',
    'territory:manage_neighborhood_aliases',
    'territory:register_neighborhood_succession'
  ) THEN
    RAISE EXCEPTION 'TERRITORIAL_CAPABILITY_DENIED';
  END IF;

  -- (3) grantee Actor deve EXISTIR e ser TENANT-BOUND (tenant_id NOT NULL). Trava a row FOR SHARE:
  --     grantee_actor_id e FK ON DELETE CASCADE → sem o lock, deletar o Actor cascatearia o grant sob
  --     os pes do futuro writer. NAO cria semantica nova de Actor; nao usa tenant como autoridade.
  PERFORM 1 FROM public.actors a
   WHERE a.id = p_grantee_actor_id AND a.tenant_id IS NOT NULL
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TERRITORIAL_CAPABILITY_DENIED';
  END IF;

  -- (4) candidatos: grant territorial ATIVO exato (grantee + key + city), lifecycle valido. NUNCA filtra
  --     por tenant (grant GLOBAL; tenant_id IS NULL). Ordem deterministica (grant_id) + FOR SHARE ate o
  --     fim da transacao chamadora. LIMIT 2 (NAO "LIMIT 1 arbitrario"): distingue 0 / 1 / >1.
  FOR v_row IN
    SELECT g.grant_id
      FROM public.actor_capability_grants g
     WHERE g.grantee_actor_id = p_grantee_actor_id
       AND g.capability_key   = p_capability_key
       AND g.scope_city_id    = p_scope_city_id
       AND g.scope_type       = 'territory'
       AND g.status           = 'active'
       AND g.revoked_at IS NULL
       AND g.valid_from <= now()
       AND (g.valid_until IS NULL OR g.valid_until > now())
     ORDER BY g.grant_id
     FOR SHARE
     LIMIT 2
  LOOP
    v_cnt := v_cnt + 1;
    v_grant_id := v_row.grant_id;
  END LOOP;

  -- (5) cardinalidade fail-closed: 0 → DENY; >1 → DENY (corrupcao, mesmo que o indice parcial torne
  --     estruturalmente impossivel — o codigo NUNCA escolhe arbitrariamente); exatamente 1 → aprova.
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'TERRITORIAL_CAPABILITY_DENIED';
  END IF;

  RETURN v_grant_id;
END;
$func$;

COMMENT ON FUNCTION fn_assert_territorial_capability(UUID, TEXT, UUID) IS
  'N2-D.3 (DECISION-0173): assertion + lock do grant territorial. Retorna grant_id aprovado; qualquer negacao = RAISE TERRITORIAL_CAPABILITY_DENIED (uniforme, nao-vazante). SECURITY DEFINER; key territorial EXATA; grant global (nunca filtra tenant); grantee Actor tenant-bound travado FOR SHARE (FK CASCADE); cardinalidade 0/1/>1 fail-closed; LEITURA — nao escreve/expira/revoga, nao consulta eventos como autoridade. Representabilidade humana compoe no runtime TS (canRepresentActor). PUBLIC sem EXECUTE; unificard_app EXECUTE na assinatura exata.';

-- ────────────────────────────────────────────────────────────────────────────
-- ACL: PUBLIC sem EXECUTE; unificard_app EXECUTE na ASSINATURA EXATA (o wrapper TS chama como app).
-- (default privilege de schema pode auto-conceder EXECUTE a app no CREATE — GRANT explicito e idempotente.)
-- ────────────────────────────────────────────────────────────────────────────
REVOKE ALL     ON FUNCTION public.fn_assert_territorial_capability(UUID, TEXT, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fn_assert_territorial_capability(UUID, TEXT, UUID) TO unificard_app;

-- ────────────────────────────────────────────────────────────────────────────
-- FAIL-CLOSED (POS): prova o shape final + AUTO-PROVAS de negacao; aborta (rollback total) se divergir.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_cnt BIGINT;
  v_src TEXT;
BEGIN
  -- exatamente UMA assinatura (sem overload), SECURITY DEFINER, owner postgres, RETURNS uuid
  SELECT count(*) INTO v_cnt FROM pg_proc WHERE pronamespace='public'::regnamespace
   AND proname='fn_assert_territorial_capability';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'MIGRATION_ABORT: fn_assert_territorial_capability com % assinaturas (esperado 1, sem overload).', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
   WHERE p.pronamespace='public'::regnamespace AND p.proname='fn_assert_territorial_capability'
     AND p.prosecdef AND r.rolname='postgres'
     AND pg_get_function_result(p.oid)='uuid'
     AND p.proconfig::text ~ 'search_path=pg_catalog, pg_temp';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'MIGRATION_ABORT: funcao nao SECURITY DEFINER/owner postgres/RETURNS uuid/search_path pinado.'; END IF;

  -- EXECUTE: unificard_app SIM; PUBLIC NAO
  IF NOT has_function_privilege('unificard_app', 'public.fn_assert_territorial_capability(uuid,text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: unificard_app sem EXECUTE no resolver.';
  END IF;
  IF has_function_privilege('public', 'public.fn_assert_territorial_capability(uuid,text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: PUBLIC possui EXECUTE no resolver — proibido.';
  END IF;

  -- fonte (checagens PRECISAS por token real de codigo — a analise comment-stripped de prefixo/tenant
  -- vive no guard audit-territorial-capability-resolver.mjs). As 6 keys territoriais exatas presentes;
  -- ZERO literal de key actor-scoped; grant NUNCA filtrado por tenant (g.tenant_id nao aparece); LEITURA.
  SELECT prosrc INTO v_src FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='fn_assert_territorial_capability';
  IF v_src !~ 'territory:create_neighborhood' OR v_src !~ 'territory:register_neighborhood_succession' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: resolver nao contem as 6 keys territoriais exatas.';
  END IF;
  IF v_src ~ 'calendar:block|calendar:unblock|services:create|services:edit|services:disable|service_order:view' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: resolver referencia literal de key actor-scoped — proibido.';
  END IF;
  IF v_src ~ 'g\.tenant_id' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: resolver filtra o grant por tenant (g.tenant_id) — grant e global; proibido.';
  END IF;
  IF v_src !~ 'FOR SHARE' THEN RAISE EXCEPTION 'MIGRATION_ABORT: resolver sem FOR SHARE.'; END IF;
  IF v_src !~ 'ORDER BY g.grant_id' THEN RAISE EXCEPTION 'MIGRATION_ABORT: resolver sem ordem deterministica.'; END IF;

  -- AUTO-PROVA 1: actor INEXISTENTE → DENY uniforme (nao vaza).
  BEGIN
    PERFORM public.fn_assert_territorial_capability(gen_random_uuid(), 'territory:create_neighborhood', gen_random_uuid());
    RAISE EXCEPTION 'MIGRATION_ABORT: auto-prova falhou — actor inexistente deveria negar.';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM !~ 'TERRITORIAL_CAPABILITY_DENIED' THEN
      RAISE EXCEPTION 'MIGRATION_ABORT: negacao nao-uniforme (actor inexistente): %', SQLERRM;
    END IF;
  END;

  -- AUTO-PROVA 2: key ACTOR-SCOPED → DENY (mesmo com actor real tenant-bound, city real).
  BEGIN
    PERFORM public.fn_assert_territorial_capability(
      (SELECT id FROM public.actors WHERE tenant_id IS NOT NULL ORDER BY id LIMIT 1),
      'calendar:block',
      (SELECT city_id FROM public.cities ORDER BY city_id LIMIT 1)
    );
    RAISE EXCEPTION 'MIGRATION_ABORT: auto-prova falhou — key actor-scoped deveria negar.';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM !~ 'TERRITORIAL_CAPABILITY_DENIED' THEN
      RAISE EXCEPTION 'MIGRATION_ABORT: negacao nao-uniforme (key actor-scoped): %', SQLERRM;
    END IF;
  END;

  -- AUTO-PROVA 3: entrada NULL → DENY.
  BEGIN
    PERFORM public.fn_assert_territorial_capability(NULL, 'territory:create_neighborhood', gen_random_uuid());
    RAISE EXCEPTION 'MIGRATION_ABORT: auto-prova falhou — entrada NULL deveria negar.';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM !~ 'TERRITORIAL_CAPABILITY_DENIED' THEN
      RAISE EXCEPTION 'MIGRATION_ABORT: negacao nao-uniforme (NULL): %', SQLERRM;
    END IF;
  END;

  -- fronteiras: nenhuma funcao de grant/revoke territorial criada; expire/regrant intactas (5 funcoes D.2/R2)
  SELECT count(*) INTO v_cnt FROM pg_proc WHERE pronamespace='public'::regnamespace
   AND proname IN ('fn_grant_actor_capability','fn_revoke_actor_capability_grant',
                   'fn_expire_actor_capability_grant','fn_regrant_actor_capability','fn_assert_actors_in_tenant');
  IF v_cnt <> 5 THEN RAISE EXCEPTION 'MIGRATION_ABORT: funcoes D.2/R2 alteradas (achado % de 5).', v_cnt; END IF;

  -- ainda ZERO grant/evento (nenhum seed); matriz/keys seladas intactas
  SELECT count(*) INTO v_cnt FROM actor_capability_grants;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % grant(s) — seed proibido na N2-D.3.', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM actor_capability_grant_events;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % evento(s) — seed proibido na N2-D.3.', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM pg_constraint WHERE conrelid='public.actor_capability_grants'::regclass
   AND conname IN ('chk_acg_scope_shape','chk_acg_territory_not_suspended','fk_acg_scope_city',
                   'chk_acg_scope_type','chk_acg_scope_capability_matrix','chk_acg_capability_nonfinancial');
  IF v_cnt <> 6 THEN RAISE EXCEPTION 'MIGRATION_ABORT: matriz/shape/keys seladas alteradas (achado % de 6).', v_cnt; END IF;
END $$;

COMMIT;
