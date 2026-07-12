-- ============================================================
-- F-NEIGHBORHOOD-CANONICAL-IDENTITY / N2-E — PRIMEIRO WRITER CANÔNICO DE NEIGHBORHOOD
-- DECISION-0172 (§P2 create/approve explícitos, §P5 HOLD, §6.1-D cinco elos) + ADENDO N2-E (D-A..D-E).
-- ============================================================
-- Abre o PRIMEIRO writer territorial: criação canônica de bairro, atômica com aprovação explícita,
-- restrita a representabilidade OWNERSHIP-DIRETO (Actor user do próprio usuário autenticado). Reutiliza
-- a casa de autoridade (fn_assert_territorial_capability, D.3) e a casa do recurso (neighborhoods).
--
-- D-C integridade do nome: CHECK forward-only (rejeita vazio/só-whitespace/borda); normalize_name INTOCADO.
-- D-D HOLD estreito: substituído SÓ p/ o INSERT canônico via TOKEN transacional interno (uso único,
--   vinculado a xid+backend+operação, criado só pela função canônica, consumido atomicamente pelo trigger,
--   inacessível à app, sem sobreviver ao commit). SEM GUC/current_setting/set_config/role/tenant/superuser/
--   session_replication_role/trigger-disable/flag-do-cliente. UPDATE/DELETE seguem SEMPRE bloqueados.
-- D-E auditoria: trilha própria append-only neighborhood_curation_events (NUNCA actor_capability_grant_events).
-- D-B create+approve = duas capabilities exatas + dois grants + dois eventos. D-A ownership-direto material.
--
-- ESCOPO NEGATIVO: ZERO correction/rename/deactivate/alias/succession; ZERO grant/revoke territorial; ZERO
-- rota/PORTA/frontend; ZERO Social/Bank; ZERO seed/grant real. fn_assert_territorial_capability/keys/matriz/
-- canRepresentActor/fn_grant/fn_revoke/fn_expire/fn_regrant INTOCADOS. Forward-only; transação única.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- FAIL-CLOSED (PRÉ)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_cnt BIGINT;
BEGIN
  IF to_regclass('public.neighborhoods') IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: neighborhoods ausente.'; END IF;
  IF to_regprocedure('public.fn_assert_territorial_capability(uuid,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: fn_assert_territorial_capability (N2-D.3) ausente — pré-requisito.';
  END IF;
  IF to_regclass('public.actor_capability_grants') IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: actor_capability_grants ausente.'; END IF;
  -- HOLD presente (será reescrito de forma consciente aqui)
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.neighborhoods'::regclass AND tgname='trg_neighborhoods_canonical_writer_hold') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: HOLD trg_neighborhoods_canonical_writer_hold ausente.';
  END IF;
  -- objetos da N2-E ainda não existem
  IF to_regclass('public.neighborhood_writer_authorizations') IS NOT NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: token table já existe.'; END IF;
  IF to_regclass('public.neighborhood_curation_events') IS NOT NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: curation events já existe.'; END IF;
  IF to_regprocedure('public.fn_create_canonical_neighborhood(uuid,uuid,uuid,uuid,text,text,text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: writer já existe.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.neighborhoods'::regclass AND conname='chk_neighborhoods_name_trimmed_nonempty') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: CHECK de nome já existe.';
  END IF;
  -- zero bairros (nada a backfillar; CHECK forward-only)
  SELECT count(*) INTO v_cnt FROM neighborhoods;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % neighborhood(s) — writer nasce em catálogo vazio.', v_cnt; END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- A. INTEGRIDADE DO NOME (D-C): CHECK forward-only próprio. normalize_name NÃO é alterado.
--    Rejeita: vazio · só-whitespace · whitespace inicial · whitespace final. Aceita espaço interno.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE neighborhoods
  ADD CONSTRAINT chk_neighborhoods_name_trimmed_nonempty CHECK (
    name ~ '[^[:space:]]' AND name !~ '^[[:space:]]' AND name !~ '[[:space:]]$'
  );
COMMENT ON CONSTRAINT chk_neighborhoods_name_trimmed_nonempty ON neighborhoods IS
  'N2-E (D-C): integridade forward-only do nome — pelo menos 1 caractere não-whitespace, sem whitespace de borda. NÃO faz trim silencioso (input inválido FALHA); NÃO colapsa espaço interno; normalize_name (helper compartilhado) intocado.';

-- ────────────────────────────────────────────────────────────────────────────
-- B. TOKEN TRANSACIONAL INTERNO (D-D): autorização efêmera, uso único, vinculada a xid+backend+operação.
--    Inacessível à app/PUBLIC. Criada só pela função canônica; consumida pelo trigger; não sobrevive ao commit.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE neighborhood_writer_authorizations (
  token_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  xid          xid8 NOT NULL,
  backend_pid  INTEGER NOT NULL,
  operation    TEXT NOT NULL CHECK (operation = 'create_neighborhood'),
  issued_at    TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON neighborhood_writer_authorizations FROM PUBLIC;
REVOKE ALL ON neighborhood_writer_authorizations FROM unificard_app;
COMMENT ON TABLE neighborhood_writer_authorizations IS
  'N2-E (D-D): tokens transacionais de uso único que autorizam o INSERT canônico em neighborhoods. Vinculados a pg_current_xact_id()+pg_backend_pid()+operação. Sem SELECT/INSERT/UPDATE/DELETE p/ app/PUBLIC — só a função canônica cria e o trigger consome. Não sobrevive ao commit (constraint trigger diferido). NÃO é bypass por GUC/role.';

-- Não-sobrevivência (D-D): AFTER INSERT diferido; no commit, se o token ainda existir (não consumido) → erro.
CREATE FUNCTION assert_neighborhood_writer_token_consumed()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $func$
BEGIN
  IF EXISTS (SELECT 1 FROM public.neighborhood_writer_authorizations WHERE token_id = NEW.token_id) THEN
    RAISE EXCEPTION 'NEIGHBORHOOD_WRITER_TOKEN_NOT_CONSUMED: token de autorização não foi consumido por um INSERT canônico — não pode sobreviver ao commit.'
      USING ERRCODE = 'raise_exception';
  END IF;
  RETURN NULL;
END;
$func$;
CREATE CONSTRAINT TRIGGER trg_nwa_must_be_consumed
  AFTER INSERT ON neighborhood_writer_authorizations
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_neighborhood_writer_token_consumed();

-- ────────────────────────────────────────────────────────────────────────────
-- C. TRILHA DE AUDITORIA (D-E): neighborhood_curation_events, append-only, própria (não grant events).
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE neighborhood_curation_events (
  event_id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id             UUID NOT NULL REFERENCES neighborhoods (neighborhood_id) ON DELETE RESTRICT,
  city_id                     UUID NOT NULL REFERENCES cities (city_id) ON DELETE RESTRICT,
  operation                   TEXT NOT NULL CHECK (operation IN ('created', 'approved')),
  capability_key              TEXT NOT NULL CHECK (capability_key IN ('territory:create_neighborhood', 'territory:approve_neighborhood')),
  grant_id                    UUID NOT NULL REFERENCES actor_capability_grants (grant_id) ON DELETE RESTRICT,
  represented_actor_id        UUID NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
  executed_by_user_id         UUID NOT NULL,
  executed_by_actor_id        UUID NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
  responsible_human_actor_id  UUID NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
  reason                      TEXT NOT NULL CHECK (reason ~ '[^[:space:]]'),
  source_kind                 TEXT NOT NULL,
  source_reference            TEXT NOT NULL,
  occurred_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_nce_one_event_per_operation UNIQUE (neighborhood_id, operation),
  CONSTRAINT chk_nce_capability_matches_operation CHECK (
    (operation = 'created'  AND capability_key = 'territory:create_neighborhood') OR
    (operation = 'approved' AND capability_key = 'territory:approve_neighborhood')
  )
);
REVOKE ALL ON neighborhood_curation_events FROM PUBLIC;
REVOKE ALL ON neighborhood_curation_events FROM unificard_app;
GRANT SELECT ON neighborhood_curation_events TO unificard_app;
COMMENT ON TABLE neighborhood_curation_events IS
  'N2-E (D-E): trilha append-only da curadoria de bairros (created/approved). Auditoria da OPERAÇÃO — NÃO é 2º SSOT do recurso (neighborhoods) nem lifecycle do grant (actor_capability_grants). UPDATE/DELETE bloqueados; exatamente 1 created + 1 approved por bairro; capability↔operation por CHECK; snapshot coerente com o pai (trigger).';

-- snapshot: evento coincide com o bairro pai (city) e o grant (city+represented); capability↔operation já por CHECK.
CREATE FUNCTION enforce_neighborhood_curation_event_snapshot()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $func$
DECLARE v_nb_city UUID; v_g_city UUID; v_g_grantee UUID; v_g_scope TEXT;
BEGIN
  SELECT city_id INTO v_nb_city FROM public.neighborhoods WHERE neighborhood_id = NEW.neighborhood_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NEIGHBORHOOD_CURATION_EVENT_ORPHAN: neighborhood_id % inexistente.', NEW.neighborhood_id USING ERRCODE = 'raise_exception';
  END IF;
  IF v_nb_city IS DISTINCT FROM NEW.city_id THEN
    RAISE EXCEPTION 'NEIGHBORHOOD_CURATION_EVENT_CITY_MISMATCH: city do evento diverge do bairro.' USING ERRCODE = 'raise_exception';
  END IF;
  SELECT scope_city_id, grantee_actor_id, scope_type INTO v_g_city, v_g_grantee, v_g_scope
    FROM public.actor_capability_grants WHERE grant_id = NEW.grant_id;
  IF NOT FOUND OR v_g_scope <> 'territory' OR v_g_city IS DISTINCT FROM NEW.city_id OR v_g_grantee IS DISTINCT FROM NEW.represented_actor_id THEN
    RAISE EXCEPTION 'NEIGHBORHOOD_CURATION_EVENT_GRANT_MISMATCH: grant do evento não é territorial da mesma city/represented_actor.' USING ERRCODE = 'raise_exception';
  END IF;
  RETURN NEW;
END;
$func$;
CREATE TRIGGER trg_nce_snapshot BEFORE INSERT ON neighborhood_curation_events
  FOR EACH ROW EXECUTE FUNCTION enforce_neighborhood_curation_event_snapshot();

CREATE FUNCTION prevent_neighborhood_curation_events_modification()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $func$
BEGIN
  RAISE EXCEPTION 'NEIGHBORHOOD_CURATION_EVENT_APPEND_ONLY: neighborhood_curation_events é append-only (UPDATE/DELETE proibidos).' USING ERRCODE = 'raise_exception';
END;
$func$;
CREATE TRIGGER trg_nce_no_update BEFORE UPDATE ON neighborhood_curation_events FOR EACH ROW EXECUTE FUNCTION prevent_neighborhood_curation_events_modification();
CREATE TRIGGER trg_nce_no_delete BEFORE DELETE ON neighborhood_curation_events FOR EACH ROW EXECUTE FUNCTION prevent_neighborhood_curation_events_modification();

-- ────────────────────────────────────────────────────────────────────────────
-- D. HOLD reescrito (D-D · alteração CONSCIENTE — audit-neighborhood-dml-hold reconciliado):
--    UPDATE/DELETE seguem SEMPRE bloqueados; INSERT defere ao trigger de consumo de token (row-level).
--    SEM GUC/current_setting/set_config/role/session — o vínculo é xid+backend, não bypass ambiental.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION enforce_neighborhoods_canonical_writer_hold()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $func$
BEGIN
  IF TG_OP = 'INSERT' THEN
    RETURN NULL; -- statement-level: INSERT é autorizado por token, consumido pelo trigger row-level abaixo
  END IF;
  RAISE EXCEPTION
    'NEIGHBORHOOD_CANONICAL_WRITER_HOLD: UPDATE/DELETE em neighborhoods proibidos (DECISION-0172 P5). Só o INSERT canônico (N2-E, via token transacional de uso único) é permitido; correction/deactivation exigem fatia própria.'
    USING ERRCODE = 'raise_exception';
END;
$func$;

-- consumo do token: BEFORE INSERT FOR EACH ROW, ENABLE ALWAYS. Consome EXATAMENTE UM token vinculado a
-- esta transação+backend+operação. 0 tokens (INSERT sem writer, ou 2ª row sem 2º token) → HOLD.
CREATE FUNCTION consume_neighborhood_writer_authorization()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $func$
DECLARE v_consumed INT;
BEGIN
  DELETE FROM public.neighborhood_writer_authorizations
   WHERE token_id = (
     SELECT token_id FROM public.neighborhood_writer_authorizations
      WHERE xid = pg_current_xact_id() AND backend_pid = pg_backend_pid() AND operation = 'create_neighborhood'
      ORDER BY issued_at, token_id
      LIMIT 1
      FOR UPDATE
   );
  GET DIAGNOSTICS v_consumed = ROW_COUNT;
  IF v_consumed <> 1 THEN
    RAISE EXCEPTION
      'NEIGHBORHOOD_CANONICAL_WRITER_HOLD: INSERT em neighborhoods sem autorização transacional válida (token ausente/já consumido). Escrita só pela função canônica fn_create_canonical_neighborhood.'
      USING ERRCODE = 'raise_exception';
  END IF;
  RETURN NEW;
END;
$func$;
CREATE TRIGGER trg_neighborhoods_writer_token_consume
  BEFORE INSERT ON neighborhoods
  FOR EACH ROW EXECUTE FUNCTION consume_neighborhood_writer_authorization();
ALTER TABLE neighborhoods ENABLE ALWAYS TRIGGER trg_neighborhoods_writer_token_consume;

-- ────────────────────────────────────────────────────────────────────────────
-- E. FUNÇÃO CANÔNICA DO WRITER (SECURITY DEFINER, owner postgres, search_path pinado, assinatura única).
--    Ownership-direto material + duas assertions D.3 (create+approve) + token + INSERT único + 2 eventos.
-- ────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION fn_create_canonical_neighborhood(
  p_tenant_id              UUID,
  p_authenticated_user_id  UUID,
  p_grantee_actor_id       UUID,
  p_city_id                UUID,
  p_name                   TEXT,
  p_source_kind            TEXT,
  p_source_reference       TEXT,
  p_evidence               TEXT,
  p_reason                 TEXT
) RETURNS UUID
-- search_path inclui public: a coluna GENERATED neighborhoods.name_normalized = normalize_name(name) chama
-- unaccent()/lower() (extensão unaccent vive em public; normalize_name é helper compartilhado, NÃO alterável).
-- Todas as refs próprias são public.*-qualificadas; public entra só para a resolução da geração do nome.
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $func$
DECLARE
  v_actor          public.actors%ROWTYPE;
  v_create_grant   UUID;
  v_approve_grant  UUID;
  v_neighborhood_id UUID;
  v_rows           INT;
BEGIN
  -- entradas obrigatórias
  IF p_tenant_id IS NULL OR p_authenticated_user_id IS NULL OR p_grantee_actor_id IS NULL OR p_city_id IS NULL
     OR p_name IS NULL OR p_source_kind IS NULL OR p_source_reference IS NULL OR p_evidence IS NULL OR p_reason IS NULL THEN
    RAISE EXCEPTION 'TERRITORIAL_CAPABILITY_DENIED' USING ERRCODE = 'raise_exception';
  END IF;

  -- VALIDATION (distinta de denial): nome inválido é erro de domínio reconhecível, sem trim silencioso.
  IF p_name !~ '[^[:space:]]' OR p_name ~ '^[[:space:]]' OR p_name ~ '[[:space:]]$' THEN
    RAISE EXCEPTION 'NEIGHBORHOOD_NAME_INVALID: nome vazio, só-whitespace ou com whitespace de borda.' USING ERRCODE = 'check_violation';
  END IF;

  -- OWNERSHIP-DIRETO (D-A): trava a row do Actor grantee; deve ser Actor user do próprio usuário no tenant.
  -- Falha de ownership = MESMO denial territorial (uniforme, não revela qual elo falhou).
  SELECT * INTO v_actor FROM public.actors a WHERE a.id = p_grantee_actor_id FOR SHARE;
  IF NOT FOUND
     OR v_actor.actor_type <> 'user'
     OR v_actor.tenant_id IS DISTINCT FROM p_tenant_id
     OR v_actor.user_id IS DISTINCT FROM p_authenticated_user_id THEN
    RAISE EXCEPTION 'TERRITORIAL_CAPABILITY_DENIED' USING ERRCODE = 'raise_exception';
  END IF;

  -- DUAS capabilities EXPLÍCITAS (D-B), ordem fixa, mesmo grantee + mesma city; cada uma trava seu grant.
  v_create_grant  := public.fn_assert_territorial_capability(p_grantee_actor_id, 'territory:create_neighborhood', p_city_id);
  v_approve_grant := public.fn_assert_territorial_capability(p_grantee_actor_id, 'territory:approve_neighborhood', p_city_id);

  -- TOKEN transacional (D-D): emitido imediatamente antes do INSERT; consumido pelo trigger row-level.
  INSERT INTO public.neighborhood_writer_authorizations (xid, backend_pid, operation)
    VALUES (pg_current_xact_id(), pg_backend_pid(), 'create_neighborhood');

  -- INSERT ÚNICO (VALUES): bairro nasce canônico e aprovado; ownership-direto → created_by = approved_by = grantee.
  INSERT INTO public.neighborhoods (
    city_id, name, is_active, source_kind, source_reference, evidence,
    created_by_actor_id, approved_by_actor_id, approved_at, valid_from_at
  ) VALUES (
    p_city_id, p_name, true, p_source_kind, p_source_reference, p_evidence,
    p_grantee_actor_id, p_grantee_actor_id, now(), now()
  ) RETURNING neighborhood_id INTO v_neighborhood_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'NEIGHBORHOOD_WRITER_CARDINALITY: INSERT canônico deve criar exatamente uma row.' USING ERRCODE = 'raise_exception';
  END IF;

  -- DOIS eventos de auditoria (D-E): created↔create_grant, approved↔approve_grant. Mesma transação.
  INSERT INTO public.neighborhood_curation_events (
    neighborhood_id, city_id, operation, capability_key, grant_id, represented_actor_id,
    executed_by_user_id, executed_by_actor_id, responsible_human_actor_id, reason, source_kind, source_reference
  ) VALUES
    (v_neighborhood_id, p_city_id, 'created',  'territory:create_neighborhood',  v_create_grant,  p_grantee_actor_id,
     p_authenticated_user_id, p_grantee_actor_id, p_grantee_actor_id, p_reason, p_source_kind, p_source_reference),
    (v_neighborhood_id, p_city_id, 'approved', 'territory:approve_neighborhood', v_approve_grant, p_grantee_actor_id,
     p_authenticated_user_id, p_grantee_actor_id, p_grantee_actor_id, p_reason, p_source_kind, p_source_reference);

  RETURN v_neighborhood_id;
END;
$func$;

COMMENT ON FUNCTION fn_create_canonical_neighborhood(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT) IS
  'N2-E: writer canônico de bairro (create+approve atômico). SECURITY DEFINER. Ownership-direto (Actor user do próprio usuário, mesmo tenant, row travada FOR SHARE) + duas assertions D.3 (create/approve, mesma city, grants travados) + token transacional de uso único + INSERT único + 2 eventos de auditoria. Denial uniforme TERRITORIAL_CAPABILITY_DENIED; nome inválido = NEIGHBORHOOD_NAME_INVALID. Retorna só neighborhood_id. NÃO recebe grant_id/capability/token/actor executor do cliente.';

-- ────────────────────────────────────────────────────────────────────────────
-- F. ACL: writer público p/ app na assinatura exata; helpers internos sem EXECUTE app/PUBLIC.
-- ────────────────────────────────────────────────────────────────────────────
REVOKE ALL     ON FUNCTION fn_create_canonical_neighborhood(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION fn_create_canonical_neighborhood(UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT) TO unificard_app;
-- funções internas (triggers): sem EXECUTE app/PUBLIC (default privilege auto-concede a app → revogar explícito)
REVOKE ALL ON FUNCTION consume_neighborhood_writer_authorization() FROM PUBLIC;
REVOKE ALL ON FUNCTION consume_neighborhood_writer_authorization() FROM unificard_app;
REVOKE ALL ON FUNCTION assert_neighborhood_writer_token_consumed() FROM PUBLIC;
REVOKE ALL ON FUNCTION assert_neighborhood_writer_token_consumed() FROM unificard_app;
REVOKE ALL ON FUNCTION enforce_neighborhood_curation_event_snapshot() FROM PUBLIC;
REVOKE ALL ON FUNCTION enforce_neighborhood_curation_event_snapshot() FROM unificard_app;
REVOKE ALL ON FUNCTION prevent_neighborhood_curation_events_modification() FROM PUBLIC;
REVOKE ALL ON FUNCTION prevent_neighborhood_curation_events_modification() FROM unificard_app;

-- ────────────────────────────────────────────────────────────────────────────
-- FAIL-CLOSED (PÓS) + AUTO-PROVA de denial (ownership inexistente → TERRITORIAL_CAPABILITY_DENIED).
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_cnt BIGINT;
BEGIN
  -- CHECK do nome presente e validado
  SELECT count(*) INTO v_cnt FROM pg_constraint WHERE conrelid='public.neighborhoods'::regclass
   AND conname='chk_neighborhoods_name_trimmed_nonempty' AND convalidated;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'MIGRATION_ABORT: CHECK de nome ausente/NOT VALID.'; END IF;

  -- tabelas + triggers
  IF to_regclass('public.neighborhood_writer_authorizations') IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: token table ausente.'; END IF;
  IF to_regclass('public.neighborhood_curation_events') IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: curation events ausente.'; END IF;
  SELECT count(*) INTO v_cnt FROM pg_trigger WHERE tgrelid='public.neighborhoods'::regclass
   AND tgname='trg_neighborhoods_writer_token_consume' AND tgenabled='A';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'MIGRATION_ABORT: consume trigger ausente/não-ENABLE ALWAYS.'; END IF;
  SELECT count(*) INTO v_cnt FROM pg_trigger WHERE tgrelid='public.neighborhoods'::regclass
   AND tgname='trg_neighborhoods_canonical_writer_hold' AND tgenabled='A';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'MIGRATION_ABORT: HOLD statement trigger não permanece ENABLE ALWAYS.'; END IF;
  SELECT count(*) INTO v_cnt FROM pg_trigger WHERE tgrelid='public.neighborhood_curation_events'::regclass AND NOT tgisinternal;
  IF v_cnt <> 3 THEN RAISE EXCEPTION 'MIGRATION_ABORT: triggers da curation (snapshot+no_update+no_delete) divergentes (% de 3).', v_cnt; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.neighborhood_writer_authorizations'::regclass AND tgname='trg_nwa_must_be_consumed') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: constraint trigger de não-sobrevivência do token ausente.';
  END IF;

  -- writer: assinatura única, SECURITY DEFINER, owner postgres, RETURNS uuid
  SELECT count(*) INTO v_cnt FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
   WHERE p.pronamespace='public'::regnamespace AND p.proname='fn_create_canonical_neighborhood'
     AND p.prosecdef AND r.rolname='postgres' AND pg_get_function_result(p.oid)='uuid';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'MIGRATION_ABORT: writer ausente/overload/não-SECURITY DEFINER/owner divergente.'; END IF;

  -- ACL: writer EXECUTE app SIM, PUBLIC NÃO; internos sem EXECUTE app
  IF NOT has_function_privilege('unificard_app','public.fn_create_canonical_neighborhood(uuid,uuid,uuid,uuid,text,text,text,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: writer sem EXECUTE p/ unificard_app.'; END IF;
  IF has_function_privilege('public','public.fn_create_canonical_neighborhood(uuid,uuid,uuid,uuid,text,text,text,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: writer com EXECUTE p/ PUBLIC — proibido.'; END IF;
  IF has_function_privilege('unificard_app','public.consume_neighborhood_writer_authorization()','EXECUTE') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: app tem EXECUTE no consume interno.'; END IF;

  -- ACL: app sem DML em neighborhoods e nas tabelas internas; SELECT em curation; nada em token
  SELECT count(*) INTO v_cnt FROM information_schema.role_table_grants
   WHERE table_name='neighborhoods' AND grantee='unificard_app' AND privilege_type IN ('INSERT','UPDATE','DELETE');
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: app ganhou DML direto em neighborhoods.'; END IF;
  SELECT count(*) INTO v_cnt FROM information_schema.role_table_grants
   WHERE table_name='neighborhood_writer_authorizations' AND grantee='unificard_app';
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: app tem privilégio na token table.'; END IF;
  SELECT count(*) INTO v_cnt FROM information_schema.role_table_grants
   WHERE table_name='neighborhood_curation_events' AND grantee='unificard_app' AND privilege_type<>'SELECT';
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: app tem DML na curation (só SELECT permitido).'; END IF;

  -- AUTO-PROVA: ownership inexistente → denial uniforme (nenhum bairro/evento/token criado).
  BEGIN
    PERFORM public.fn_create_canonical_neighborhood(
      gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
      (SELECT city_id FROM public.cities ORDER BY city_id LIMIT 1),
      'Prova', 'internal_curation', 'ref', 'evidencia', 'motivo'
    );
    RAISE EXCEPTION 'MIGRATION_ABORT: auto-prova falhou — ownership inexistente deveria negar.';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM !~ 'TERRITORIAL_CAPABILITY_DENIED' THEN
      RAISE EXCEPTION 'MIGRATION_ABORT: denial não-uniforme (ownership): %', SQLERRM;
    END IF;
  END;

  -- zero resíduo da auto-prova
  SELECT count(*) INTO v_cnt FROM neighborhoods; IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % bairro(s) após auto-prova.', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM neighborhood_curation_events; IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % evento(s) após auto-prova.', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM neighborhood_writer_authorizations; IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % token(s) após auto-prova.', v_cnt; END IF;
END $$;

COMMIT;
