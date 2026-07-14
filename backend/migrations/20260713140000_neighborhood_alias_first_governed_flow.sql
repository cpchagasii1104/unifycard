-- 20260713140000_neighborhood_alias_first_governed_flow.sql
-- F-NEIGHBORHOOD-CANONICAL-AUTO-INGESTION · N1 — FLUXO GOVERNADO DE ALIASES (CURITIBA ALIAS-FIRST).
-- DECISION-0174 (manifest híbrido; 4 fatos distintos capability_granted/manifest_approved/
--   automation_executed/alias_created; writer fn_create_canonical_alias; HOLD estreito; conflito por
--   (city_id, alias_normalized); atomicidade sem commit parcial; resolver inalterado; PORTA migration=0 /
--   N1 migration obrigatória) + PORTA-TERRITORY-ALIASES (grant b6ee696d de manage_neighborhood_aliases).
--
-- O QUE ESTA MIGRATION FAZ (e SOMENTE isto):
--   1. quatro casas próprias do domínio de aliases (NUNCA engine genérica de policies):
--        neighborhood_alias_manifest_events        (lifecycle append-only do manifest — approved/revoked/superseded)
--        neighborhood_alias_automation_executions  (execução técnica NÃO-Actor, executor_kind='job')
--        neighborhood_alias_curation_events         (trilha append-only própria de alias — alias_created)
--        neighborhood_alias_writer_authorizations   (token one-use POR LINHA, transacional)
--   2. evolução ESTREITA do HOLD de neighborhood_aliases: statement permite só a classe INSERT;
--        row-level exige e consome token one-use vinculado a xid+backend+linha; UPDATE/DELETE SEMPRE bloqueados;
--   3. writer canônico fn_create_canonical_alias (SECURITY DEFINER, search_path pinado, EXECUTE fechado):
--        carrega+trava approval → valida manifest/hash → sem revogação/supersessão → revalida+trava grant →
--        capability exata + Curitiba → valida execution → bairro ativo → deriva/prova a cidade → recalcula
--        alias_normalized → replay/conflito → emite token → INSERT → consome token → evento alias_created;
--   4. duas casas de registro governadas (SECURITY DEFINER):
--        fn_register_alias_manifest_approval   (capability em DB; representação é provada no serviço TS)
--        fn_register_alias_automation_execution (execução técnica não-Actor; contagens do preflight);
--   5. ACL fechada + fail-closed pré/pós + auto-prova de denial (writer nega sem approval válido).
--
-- O QUE ELA NÃO FAZ: NÃO cria bairro; NÃO altera/apaga bairro ou alias; NÃO cria cidade; NÃO chama provider;
--   NÃO transforma provider em source; NÃO insere texto postal como bairro; NÃO cria conta regional; NÃO toca
--   split/ledger/saldo; NÃO vincula Actor a fundo; NÃO altera onboarding; NÃO cria rota pública nem tela; NÃO
--   importa Social/Bank; NÃO altera o resolver postal; NÃO abre N2..N7. Δbank permanece zero.
--   NÃO persiste manifest_approved/automation_executed/alias real — isso exige aprovação humana do conteúdo
--   exato (fora desta migration). Forward-only; transação única.
--
-- Guard: audit-curitiba-neighborhood-alias-first.mjs.

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 0. FAIL-CLOSED (PRÉ)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v_hold "char"; v_immut "char";
BEGIN
  IF to_regclass('public.neighborhoods') IS NULL OR to_regclass('public.neighborhood_aliases') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: neighborhoods/neighborhood_aliases ausentes — pré-requisito N2-B.';
  END IF;
  IF to_regclass('public.cities') IS NULL OR to_regclass('public.actors') IS NULL
     OR to_regclass('public.actor_capability_grants') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: cities/actors/actor_capability_grants ausentes.';
  END IF;
  IF to_regprocedure('public.fn_assert_territorial_capability(uuid,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: fn_assert_territorial_capability ausente — casa de autoridade é pré-requisito.';
  END IF;
  IF (SELECT count(*) FROM pg_proc WHERE proname='normalize_name') = 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: normalize_name ausente.';
  END IF;
  -- objetos N1 ainda não existem
  IF to_regclass('public.neighborhood_alias_manifest_events') IS NOT NULL
     OR to_regclass('public.neighborhood_alias_automation_executions') IS NOT NULL
     OR to_regclass('public.neighborhood_alias_curation_events') IS NOT NULL
     OR to_regclass('public.neighborhood_alias_writer_authorizations') IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: alguma casa N1 já existe — não criar estrutura concorrente.';
  END IF;
  IF to_regprocedure('public.fn_create_canonical_alias(uuid,uuid,uuid,text,text,text,text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: writer fn_create_canonical_alias já existe.';
  END IF;
  -- aliases em HOLD físico incondicional (N2-B) — será evoluído estreitamente aqui
  SELECT tgenabled INTO v_hold FROM pg_trigger
   WHERE tgrelid='public.neighborhood_aliases'::regclass AND tgname='trg_neighborhood_aliases_writer_hold';
  IF v_hold IS DISTINCT FROM 'A' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: HOLD de aliases não está ENABLE ALWAYS (tgenabled=%).', COALESCE(v_hold::text,'ausente');
  END IF;
  SELECT tgenabled INTO v_immut FROM pg_trigger
   WHERE tgrelid='public.neighborhood_aliases'::regclass AND tgname='trg_neighborhood_alias_identity_immutability';
  IF v_immut IS NULL OR v_immut NOT IN ('O','A') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: imutabilidade do alias ausente/rebaixada.';
  END IF;
  -- aliases começam VAZIOS (N1 não faz seed; alias real exige aprovação humana fora desta migration)
  IF (SELECT count(*) FROM neighborhood_aliases) <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: neighborhood_aliases deveria estar VAZIA em N1.';
  END IF;
  -- ACL de aliases = SELECT-only (N2-B)
  IF has_table_privilege('unificard_app','public.neighborhood_aliases','INSERT')
     OR NOT has_table_privilege('unificard_app','public.neighborhood_aliases','SELECT') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: ACL de aliases divergente (esperado SELECT-only).';
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 1. CASA — LIFECYCLE DO MANIFEST (append-only): manifest_approved / manifest_revoked / manifest_superseded
--    §5: "status" nunca é autoridade; aprovação é imutável; aprovação não serve para outro hash.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE neighborhood_alias_manifest_events (
  event_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type          TEXT NOT NULL CHECK (event_type IN ('manifest_approved','manifest_revoked','manifest_superseded')),
  manifest_code       TEXT NOT NULL CHECK (manifest_code ~ '[^[:space:]]'),
  manifest_version    TEXT NOT NULL CHECK (manifest_version ~ '[^[:space:]]'),
  manifest_hash       TEXT NOT NULL CHECK (manifest_hash ~ '^[0-9a-f]{64}$'),
  city_id             UUID NOT NULL REFERENCES cities (city_id) ON DELETE RESTRICT,
  line_count          INTEGER NOT NULL CHECK (line_count >= 0),
  approved_by_user_id  UUID NOT NULL,
  approved_by_actor_id UUID NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
  territorial_grant_id UUID NOT NULL REFERENCES actor_capability_grants (grant_id) ON DELETE RESTRICT,
  capability_key      TEXT NOT NULL CHECK (capability_key = 'territory:manage_neighborhood_aliases'),
  scope_city_id       UUID NOT NULL REFERENCES cities (city_id) ON DELETE RESTRICT,
  supersedes_event_id UUID NULL REFERENCES neighborhood_alias_manifest_events (event_id) ON DELETE RESTRICT,
  event_reason        TEXT NOT NULL CHECK (event_reason ~ '[^[:space:]]'),
  evidence            TEXT NOT NULL CHECK (evidence ~ '[^[:space:]]'),
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_name_scope_city_coherence CHECK (city_id = scope_city_id),
  -- exatamente 1 approval vivo por (code, version, hash): aprovação não se repete para o mesmo conteúdo
  CONSTRAINT uq_name_approved_per_manifest UNIQUE (manifest_code, manifest_version, manifest_hash, event_type),
  -- supersessão/revogação referenciam um evento anterior; aprovação não
  CONSTRAINT chk_name_supersedes_shape CHECK (
    (event_type = 'manifest_superseded' AND supersedes_event_id IS NOT NULL) OR
    (event_type <> 'manifest_superseded')
  )
);
CREATE INDEX idx_name_manifest_events_manifest ON neighborhood_alias_manifest_events (manifest_code, manifest_version, manifest_hash);
REVOKE ALL ON neighborhood_alias_manifest_events FROM PUBLIC;
REVOKE ALL ON neighborhood_alias_manifest_events FROM unificard_app;
GRANT SELECT ON neighborhood_alias_manifest_events TO unificard_app;
COMMENT ON TABLE neighborhood_alias_manifest_events IS
  'N1 (DECISION-0174): lifecycle append-only do manifest de aliases. manifest_approved = DECISÃO HUMANA '
  '(representação provada no serviço TS via canRepresentActor + capability em DB via fn_assert_territorial_capability). '
  'UPDATE/DELETE bloqueados; aprovação imutável; aprovação de um hash não vale para outro; revogação/supersessão '
  'NÃO reescrevem eventos anteriores. "status" é read-model, nunca autoridade. NÃO reusa neighborhood_succession_events.';

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 2. CASA — EXECUÇÃO TÉCNICA NÃO-ACTOR (§7): executor_kind='job'; sem FK obrigatória a actors; sem capability.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE neighborhood_alias_automation_executions (
  automation_execution_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executor_kind             TEXT NOT NULL CHECK (executor_kind = 'job'),
  executor_name             TEXT NOT NULL CHECK (executor_name ~ '[^[:space:]]'),
  run_id                    TEXT NOT NULL CHECK (run_id ~ '[^[:space:]]'),
  application_name          TEXT NOT NULL CHECK (application_name ~ '[^[:space:]]'),
  code_commit               TEXT NOT NULL CHECK (code_commit ~ '[^[:space:]]'),
  manifest_code             TEXT NOT NULL,
  manifest_version          TEXT NOT NULL,
  manifest_hash             TEXT NOT NULL CHECK (manifest_hash ~ '^[0-9a-f]{64}$'),
  manifest_approval_event_id UUID NOT NULL REFERENCES neighborhood_alias_manifest_events (event_id) ON DELETE RESTRICT,
  started_at                TIMESTAMPTZ NOT NULL,
  completed_at              TIMESTAMPTZ NOT NULL,
  inserted_count            INTEGER NOT NULL CHECK (inserted_count >= 0),
  replay_count              INTEGER NOT NULL CHECK (replay_count >= 0),
  conflict_count            INTEGER NOT NULL CHECK (conflict_count = 0),
  outcome                   TEXT NOT NULL CHECK (outcome IN ('succeeded')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_naae_completed_after_started CHECK (completed_at >= started_at),
  -- SEM coluna actor: execução técnica NÃO representa humano nem carrega capability.
  CONSTRAINT chk_naae_no_actor_columns CHECK (true)
);
CREATE INDEX idx_naae_approval ON neighborhood_alias_automation_executions (manifest_approval_event_id);
REVOKE ALL ON neighborhood_alias_automation_executions FROM PUBLIC;
REVOKE ALL ON neighborhood_alias_automation_executions FROM unificard_app;
GRANT SELECT ON neighborhood_alias_automation_executions TO unificard_app;
COMMENT ON TABLE neighborhood_alias_automation_executions IS
  'N1 (§7): execução técnica NÃO-Actor da aplicação do manifest. executor_kind=job; SEM FK a actors, SEM '
  'capability, NÃO representa humano, NÃO aprova manifest, NÃO seleciona novas linhas, NÃO é autoridade. '
  'Inserida em uma única operação completa (contagens do preflight), append-only (UPDATE/DELETE bloqueados). '
  'outcome só ''succeeded'' — falha = ROLLBACK integral (linha nunca persiste). conflict_count sempre 0 (conflito aborta o lote).';

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 3. CASA — TRILHA PRÓPRIA DE ALIAS (append-only): alias_created (§8). NÃO reusa neighborhood_curation_events.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE neighborhood_alias_curation_events (
  event_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation                 TEXT NOT NULL CHECK (operation = 'alias_created'),
  alias_id                  UUID NOT NULL REFERENCES neighborhood_aliases (id) ON DELETE RESTRICT,
  neighborhood_id           UUID NOT NULL REFERENCES neighborhoods (neighborhood_id) ON DELETE RESTRICT,
  city_id                   UUID NOT NULL REFERENCES cities (city_id) ON DELETE RESTRICT,
  alias_text                TEXT NOT NULL CHECK (alias_text ~ '[^[:space:]]'),
  alias_normalized          TEXT NOT NULL CHECK (alias_normalized ~ '[^[:space:]]'),
  manifest_code             TEXT NOT NULL,
  manifest_version          TEXT NOT NULL,
  manifest_hash             TEXT NOT NULL CHECK (manifest_hash ~ '^[0-9a-f]{64}$'),
  manifest_line_key         TEXT NOT NULL CHECK (manifest_line_key ~ '[^[:space:]]'),
  manifest_approval_event_id UUID NOT NULL REFERENCES neighborhood_alias_manifest_events (event_id) ON DELETE RESTRICT,
  automation_execution_id   UUID NOT NULL REFERENCES neighborhood_alias_automation_executions (automation_execution_id) ON DELETE RESTRICT,
  approver_actor_id         UUID NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
  approver_user_id          UUID NOT NULL,
  territorial_grant_id      UUID NOT NULL REFERENCES actor_capability_grants (grant_id) ON DELETE RESTRICT,
  capability_key            TEXT NOT NULL CHECK (capability_key = 'territory:manage_neighborhood_aliases'),
  source_kind               TEXT NOT NULL CHECK (source_kind IN ('government_official','public_documentary','internal_curation')),
  source_reference          TEXT NOT NULL CHECK (source_reference ~ '[^[:space:]]'),
  evidence                  TEXT NOT NULL CHECK (evidence ~ '[^[:space:]]'),
  occurred_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- exatamente 1 evento por alias inserido
  CONSTRAINT uq_nace_one_event_per_alias UNIQUE (alias_id)
);
CREATE INDEX idx_nace_manifest ON neighborhood_alias_curation_events (manifest_code, manifest_version, manifest_hash);
CREATE INDEX idx_nace_execution ON neighborhood_alias_curation_events (automation_execution_id);
REVOKE ALL ON neighborhood_alias_curation_events FROM PUBLIC;
REVOKE ALL ON neighborhood_alias_curation_events FROM unificard_app;
GRANT SELECT ON neighborhood_alias_curation_events TO unificard_app;
COMMENT ON TABLE neighborhood_alias_curation_events IS
  'N1 (§8): trilha append-only PRÓPRIA da criação de alias. Cada alias inserido tem EXATAMENTE 1 evento que '
  'referencia obrigatoriamente approval + execution + grant + linha do manifest. UPDATE/DELETE bloqueados. '
  'NÃO reusa neighborhood_curation_events (bairro) nem cria executed_by_actor_id falso para o job — o job é '
  'rastreado por automation_execution_id; a autoridade humana por approver_actor_id/grant.';

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 4. CASA — AUTORIZAÇÃO ONE-USE POR LINHA (§9): token transacional, inacessível à app, não sobrevive ao commit.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE neighborhood_alias_writer_authorizations (
  token_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  xid                     xid8 NOT NULL,
  backend_pid             INTEGER NOT NULL,
  operation               TEXT NOT NULL CHECK (operation = 'insert_alias'),
  manifest_code           TEXT NOT NULL,
  manifest_version        TEXT NOT NULL,
  manifest_hash           TEXT NOT NULL,
  manifest_line_key       TEXT NOT NULL,
  neighborhood_id         UUID NOT NULL,
  alias_normalized        TEXT NOT NULL,
  automation_execution_id UUID NOT NULL,
  issued_at               TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON neighborhood_alias_writer_authorizations FROM PUBLIC;
REVOKE ALL ON neighborhood_alias_writer_authorizations FROM unificard_app;
COMMENT ON TABLE neighborhood_alias_writer_authorizations IS
  'N1 (§9): tokens transacionais de uso único que autorizam UM INSERT de alias. Vinculados a '
  'pg_current_xact_id()+pg_backend_pid()+operation+neighborhood_id+alias_normalized+execution — não '
  'transferíveis para outra linha/bairro/forma/execução. Sem SELECT/DML p/ app/PUBLIC; só o writer canônico '
  'cria e o trigger consome. Não sobrevive ao commit (constraint trigger diferido). NÃO é bypass por GUC/role/tenant.';

-- não-sobrevivência: AFTER INSERT diferido; no commit, se o token existir (não consumido) → erro.
CREATE FUNCTION assert_alias_writer_token_consumed()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $func$
BEGIN
  IF EXISTS (SELECT 1 FROM public.neighborhood_alias_writer_authorizations WHERE token_id = NEW.token_id) THEN
    RAISE EXCEPTION 'NEIGHBORHOOD_ALIAS_WRITER_TOKEN_NOT_CONSUMED: token de autorização de alias não foi consumido por um INSERT canônico — não pode sobreviver ao commit.'
      USING ERRCODE = 'raise_exception';
  END IF;
  RETURN NULL;
END;
$func$;
CREATE CONSTRAINT TRIGGER trg_nawa_must_be_consumed
  AFTER INSERT ON neighborhood_alias_writer_authorizations
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_alias_writer_token_consumed();

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 5. APPEND-ONLY das três casas de evento/execução (UPDATE/DELETE bloqueados).
-- ════════════════════════════════════════════════════════════════════════════════════════════════
CREATE FUNCTION prevent_alias_governance_house_modification()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $func$
BEGIN
  RAISE EXCEPTION 'NEIGHBORHOOD_ALIAS_HOUSE_APPEND_ONLY: % é append-only (UPDATE/DELETE proibidos). Retificação = decisão própria + nova trilha.', TG_TABLE_NAME
    USING ERRCODE = 'raise_exception';
END;
$func$;
CREATE TRIGGER trg_name_no_modify   BEFORE UPDATE OR DELETE ON neighborhood_alias_manifest_events       FOR EACH ROW EXECUTE FUNCTION prevent_alias_governance_house_modification();
CREATE TRIGGER trg_naae_no_modify   BEFORE UPDATE OR DELETE ON neighborhood_alias_automation_executions FOR EACH ROW EXECUTE FUNCTION prevent_alias_governance_house_modification();
CREATE TRIGGER trg_nace_no_modify   BEFORE UPDATE OR DELETE ON neighborhood_alias_curation_events       FOR EACH ROW EXECUTE FUNCTION prevent_alias_governance_house_modification();

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 6. EVOLUÇÃO ESTREITA DO HOLD de neighborhood_aliases (§10) — molde selado N2-E.
--    statement: só a classe INSERT segue; UPDATE/DELETE SEMPRE bloqueados.
--    row-level: exige e consome token one-use vinculado a xid+backend+linha (neighborhood+alias_normalized).
-- ════════════════════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION enforce_neighborhood_aliases_writer_hold()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $func$
BEGIN
  IF TG_OP = 'INSERT' THEN
    RETURN NULL; -- statement-level: INSERT autorizado por token, consumido pelo trigger row-level abaixo
  END IF;
  RAISE EXCEPTION
    'NEIGHBORHOOD_ALIAS_CANONICAL_WRITER_HOLD: UPDATE/DELETE em neighborhood_aliases proibidos (N2-B/N1). '
    'Só o INSERT canônico (N1, via token transacional de uso único por linha) é permitido; correção/desativação '
    'exigem fatia própria. Alias nunca nasce de texto livre/provider.'
    USING ERRCODE = 'raise_exception';
END;
$func$;

CREATE FUNCTION consume_alias_writer_authorization()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $func$
DECLARE v_consumed INT; v_norm TEXT;
BEGIN
  -- NEW.alias_normalized é coluna GENERATED: ainda NÃO computada em trigger BEFORE INSERT (seria NULL).
  -- Recalcula a forma normalizada a partir de NEW.alias (mesma função canônica normalize_name).
  v_norm := public.normalize_name(NEW.alias);
  DELETE FROM public.neighborhood_alias_writer_authorizations
   WHERE token_id = (
     SELECT token_id FROM public.neighborhood_alias_writer_authorizations
      WHERE xid = pg_current_xact_id() AND backend_pid = pg_backend_pid() AND operation = 'insert_alias'
        AND neighborhood_id = NEW.neighborhood_id AND alias_normalized = v_norm
      ORDER BY issued_at, token_id
      LIMIT 1
      FOR UPDATE
   );
  GET DIAGNOSTICS v_consumed = ROW_COUNT;
  IF v_consumed <> 1 THEN
    RAISE EXCEPTION
      'NEIGHBORHOOD_ALIAS_CANONICAL_WRITER_HOLD: INSERT em neighborhood_aliases sem autorização transacional '
      'válida para ESTA linha (token ausente/já consumido/de outra linha). Escrita só pela função canônica fn_create_canonical_alias.'
      USING ERRCODE = 'raise_exception';
  END IF;
  RETURN NEW;
END;
$func$;
CREATE TRIGGER trg_neighborhood_aliases_writer_token_consume
  BEFORE INSERT ON neighborhood_aliases
  FOR EACH ROW EXECUTE FUNCTION consume_alias_writer_authorization();
ALTER TABLE neighborhood_aliases ENABLE ALWAYS TRIGGER trg_neighborhood_aliases_writer_token_consume;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 7. REGISTRO DO MANIFEST APROVADO (§6) — capability em DB. Representação é provada NO SERVIÇO TS (canRepresentActor).
--    SECURITY DEFINER; EXECUTE só p/ unificard_app (o serviço TS chama, depois de canRepresentActor).
-- ════════════════════════════════════════════════════════════════════════════════════════════════
CREATE FUNCTION fn_register_alias_manifest_approval(
  p_approver_actor_id  UUID,
  p_approver_user_id   UUID,
  p_city_id            UUID,
  p_manifest_code      TEXT,
  p_manifest_version   TEXT,
  p_manifest_hash      TEXT,
  p_line_count         INTEGER,
  p_event_reason       TEXT,
  p_evidence           TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $func$
DECLARE v_grant UUID; v_event UUID;
BEGIN
  IF p_approver_actor_id IS NULL OR p_approver_user_id IS NULL OR p_city_id IS NULL
     OR p_manifest_code IS NULL OR p_manifest_version IS NULL OR p_manifest_hash IS NULL
     OR p_line_count IS NULL OR p_event_reason IS NULL OR p_evidence IS NULL THEN
    RAISE EXCEPTION 'TERRITORIAL_CAPABILITY_DENIED' USING ERRCODE = 'raise_exception';
  END IF;
  IF p_manifest_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'ALIAS_MANIFEST_HASH_INVALID: hash deve ser sha256 hex de 64 chars.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_line_count < 1 THEN
    RAISE EXCEPTION 'ALIAS_MANIFEST_EMPTY: manifest aprovado não pode ser vazio (line_count>=1).' USING ERRCODE = 'check_violation';
  END IF;
  -- CAPABILITY EXATA + Curitiba + trava do grant (representação é do serviço TS; ortogonal)
  v_grant := public.fn_assert_territorial_capability(p_approver_actor_id, 'territory:manage_neighborhood_aliases', p_city_id);
  INSERT INTO public.neighborhood_alias_manifest_events (
    event_type, manifest_code, manifest_version, manifest_hash, city_id, line_count,
    approved_by_user_id, approved_by_actor_id, territorial_grant_id, capability_key, scope_city_id,
    supersedes_event_id, event_reason, evidence
  ) VALUES (
    'manifest_approved', p_manifest_code, p_manifest_version, p_manifest_hash, p_city_id, p_line_count,
    p_approver_user_id, p_approver_actor_id, v_grant, 'territory:manage_neighborhood_aliases', p_city_id,
    NULL, p_event_reason, p_evidence
  ) RETURNING event_id INTO v_event;
  RETURN v_event;
END;
$func$;
COMMENT ON FUNCTION fn_register_alias_manifest_approval(UUID,UUID,UUID,TEXT,TEXT,TEXT,INTEGER,TEXT,TEXT) IS
  'N1 (§6): registra manifest_approved. Prova CAPABILITY em DB (fn_assert_territorial_capability, key exata + '
  'Curitiba, grant travado). A REPRESENTAÇÃO (canRepresentActor) é obrigatória e provada ANTES no serviço TS — '
  'as duas são ortogonais. NÃO cria execução nem alias. Denial uniforme TERRITORIAL_CAPABILITY_DENIED.';

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 8. REGISTRO DA EXECUÇÃO TÉCNICA (§7) — não-Actor; contagens do preflight; uma única inserção.
--    SECURITY DEFINER; EXECUTE só p/ unificard_app (o apply-job chama).
-- ════════════════════════════════════════════════════════════════════════════════════════════════
CREATE FUNCTION fn_register_alias_automation_execution(
  p_manifest_approval_event_id UUID,
  p_executor_name              TEXT,
  p_run_id                     TEXT,
  p_application_name           TEXT,
  p_code_commit                TEXT,
  p_started_at                 TIMESTAMPTZ,
  p_inserted_count             INTEGER,
  p_replay_count               INTEGER
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $func$
DECLARE v_appr public.neighborhood_alias_manifest_events%ROWTYPE; v_id UUID;
BEGIN
  IF p_manifest_approval_event_id IS NULL OR p_executor_name IS NULL OR p_run_id IS NULL
     OR p_application_name IS NULL OR p_code_commit IS NULL OR p_started_at IS NULL
     OR p_inserted_count IS NULL OR p_replay_count IS NULL THEN
    RAISE EXCEPTION 'ALIAS_EXECUTION_INPUT_INVALID: entradas obrigatórias ausentes.' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_appr FROM public.neighborhood_alias_manifest_events
   WHERE event_id = p_manifest_approval_event_id AND event_type = 'manifest_approved' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ALIAS_EXECUTION_APPROVAL_NOT_FOUND: approval inexistente/rejeitado para a execução.' USING ERRCODE = 'raise_exception';
  END IF;
  -- approval não revogado/supersedido
  IF EXISTS (SELECT 1 FROM public.neighborhood_alias_manifest_events e
              WHERE e.event_type IN ('manifest_revoked','manifest_superseded')
                AND e.manifest_code = v_appr.manifest_code AND e.manifest_version = v_appr.manifest_version
                AND e.manifest_hash = v_appr.manifest_hash) THEN
    RAISE EXCEPTION 'ALIAS_EXECUTION_APPROVAL_NOT_LIVE: manifest revogado/supersedido — execução fail-closed.' USING ERRCODE = 'raise_exception';
  END IF;
  INSERT INTO public.neighborhood_alias_automation_executions (
    executor_kind, executor_name, run_id, application_name, code_commit,
    manifest_code, manifest_version, manifest_hash, manifest_approval_event_id,
    started_at, completed_at, inserted_count, replay_count, conflict_count, outcome
  ) VALUES (
    'job', p_executor_name, p_run_id, p_application_name, p_code_commit,
    v_appr.manifest_code, v_appr.manifest_version, v_appr.manifest_hash, p_manifest_approval_event_id,
    p_started_at, now(), p_inserted_count, p_replay_count, 0, 'succeeded'
  ) RETURNING automation_execution_id INTO v_id;
  RETURN v_id;
END;
$func$;
COMMENT ON FUNCTION fn_register_alias_automation_execution(UUID,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ,INTEGER,INTEGER) IS
  'N1 (§7): registra a execução técnica não-Actor (executor_kind=job) em UMA inserção com as contagens do '
  'preflight. Deriva manifest_code/version/hash do approval (não confia em caller). Exige approval vivo '
  '(não revogado/supersedido). Sem capability, sem representação, sem Actor. conflict_count sempre 0.';

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 9. WRITER CANÔNICO DE ALIAS (§11) — SECURITY DEFINER, search_path pinado, assinatura única, ACL fechada.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
CREATE FUNCTION fn_create_canonical_alias(
  p_manifest_approval_event_id UUID,
  p_automation_execution_id    UUID,
  p_neighborhood_id            UUID,
  p_alias_text                 TEXT,
  p_source_kind                TEXT,
  p_source_reference           TEXT,
  p_evidence                   TEXT,
  p_manifest_line_key          TEXT
) RETURNS TABLE(alias_id UUID, curation_event_id UUID, outcome TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $func$
DECLARE
  v_appr   public.neighborhood_alias_manifest_events%ROWTYPE;
  v_exec   public.neighborhood_alias_automation_executions%ROWTYPE;
  v_grant  UUID;
  v_nb_city UUID; v_nb_active BOOLEAN;
  v_norm   TEXT;
  v_existing_same UUID;
  v_conflict INT;
  v_alias  UUID; v_event UUID; v_rows INT;
BEGIN
  IF p_manifest_approval_event_id IS NULL OR p_automation_execution_id IS NULL OR p_neighborhood_id IS NULL
     OR p_alias_text IS NULL OR p_source_kind IS NULL OR p_source_reference IS NULL
     OR p_evidence IS NULL OR p_manifest_line_key IS NULL THEN
    RAISE EXCEPTION 'ALIAS_WRITER_INPUT_INVALID: entradas obrigatórias ausentes.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_alias_text !~ '[^[:space:]]' OR p_alias_text ~ '^[[:space:]]' OR p_alias_text ~ '[[:space:]]$' THEN
    RAISE EXCEPTION 'ALIAS_TEXT_INVALID: alias vazio, só-whitespace ou com whitespace de borda.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_source_kind NOT IN ('government_official','public_documentary','internal_curation') THEN
    RAISE EXCEPTION 'ALIAS_SOURCE_KIND_INVALID: vocabulário governado.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_source_reference !~ '[^[:space:]]' OR p_evidence !~ '[^[:space:]]' OR p_manifest_line_key !~ '[^[:space:]]' THEN
    RAISE EXCEPTION 'ALIAS_PROVENANCE_INVALID: referência/evidência/line_key obrigatórias.' USING ERRCODE = 'check_violation';
  END IF;

  -- (1) approval carregado+travado; deve ser manifest_approved
  SELECT * INTO v_appr FROM public.neighborhood_alias_manifest_events
   WHERE event_id = p_manifest_approval_event_id AND event_type = 'manifest_approved' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TERRITORIAL_CAPABILITY_DENIED' USING ERRCODE = 'raise_exception';
  END IF;
  -- (2) approval não revogado/supersedido
  IF EXISTS (SELECT 1 FROM public.neighborhood_alias_manifest_events e
              WHERE e.event_type IN ('manifest_revoked','manifest_superseded')
                AND e.manifest_code = v_appr.manifest_code AND e.manifest_version = v_appr.manifest_version
                AND e.manifest_hash = v_appr.manifest_hash) THEN
    RAISE EXCEPTION 'ALIAS_APPROVAL_NOT_LIVE: manifest revogado/supersedido.' USING ERRCODE = 'raise_exception';
  END IF;
  -- (3) execução técnica válida, vinculada a este approval, é job
  SELECT * INTO v_exec FROM public.neighborhood_alias_automation_executions
   WHERE automation_execution_id = p_automation_execution_id FOR SHARE;
  IF NOT FOUND OR v_exec.manifest_approval_event_id IS DISTINCT FROM p_manifest_approval_event_id
     OR v_exec.executor_kind <> 'job' THEN
    RAISE EXCEPTION 'ALIAS_EXECUTION_INVALID: execução ausente/não vinculada ao approval/não-job.' USING ERRCODE = 'raise_exception';
  END IF;
  -- (4) grant revalidado+travado; capability exata + a MESMA cidade do approval (Curitiba). Coerência com o approval.
  v_grant := public.fn_assert_territorial_capability(v_appr.approved_by_actor_id, 'territory:manage_neighborhood_aliases', v_appr.scope_city_id);
  IF v_grant IS DISTINCT FROM v_appr.territorial_grant_id THEN
    RAISE EXCEPTION 'TERRITORIAL_CAPABILITY_DENIED' USING ERRCODE = 'raise_exception';
  END IF;
  -- (5) bairro ativo; deriva a cidade; prova pertencer à cidade do approval
  SELECT city_id, is_active INTO v_nb_city, v_nb_active FROM public.neighborhoods WHERE neighborhood_id = p_neighborhood_id FOR SHARE;
  IF NOT FOUND OR v_nb_active IS NOT TRUE THEN
    RAISE EXCEPTION 'ALIAS_NEIGHBORHOOD_INVALID: bairro inexistente/inativo.' USING ERRCODE = 'raise_exception';
  END IF;
  IF v_nb_city IS DISTINCT FROM v_appr.scope_city_id THEN
    RAISE EXCEPTION 'ALIAS_NEIGHBORHOOD_OUT_OF_SCOPE: bairro fora da cidade do manifest.' USING ERRCODE = 'raise_exception';
  END IF;
  -- (6) recalcula alias_normalized (ignora qualquer normalização soberana do arquivo)
  v_norm := public.normalize_name(p_alias_text);
  IF v_norm IS NULL OR v_norm !~ '[^[:space:]]' THEN
    RAISE EXCEPTION 'ALIAS_NORMALIZED_EMPTY: normalização do alias resultou vazia.' USING ERRCODE = 'check_violation';
  END IF;
  -- redundância: alias que normaliza igual ao nome canônico do próprio bairro não é alias
  IF v_norm = (SELECT name_normalized FROM public.neighborhoods WHERE neighborhood_id = p_neighborhood_id) THEN
    RAISE EXCEPTION 'ALIAS_REDUNDANT_WITH_CANONICAL: normalização do alias == name_normalized do bairro (nada a criar).' USING ERRCODE = 'check_violation';
  END IF;
  -- (7) replay: relação EXATA (mesmo bairro, mesma forma normalizada) já existe → no-op idempotente
  SELECT id INTO v_existing_same FROM public.neighborhood_aliases
   WHERE neighborhood_id = p_neighborhood_id AND alias_normalized = v_norm;
  IF v_existing_same IS NOT NULL THEN
    alias_id := v_existing_same; curation_event_id := NULL; outcome := 'replayed'; RETURN NEXT; RETURN;
  END IF;
  -- (7b) conflito: mesma forma normalizada NA MESMA CIDADE ligada a bairro DIFERENTE → aborta (sem winner/LIMIT 1/score)
  SELECT count(*) INTO v_conflict FROM public.neighborhood_aliases a
    JOIN public.neighborhoods n ON n.neighborhood_id = a.neighborhood_id
   WHERE n.city_id = v_nb_city AND a.alias_normalized = v_norm AND a.neighborhood_id <> p_neighborhood_id;
  IF v_conflict > 0 THEN
    RAISE EXCEPTION 'ALIAS_CITY_NORMALIZED_CONFLICT: mesma forma normalizada já liga a outro bairro na cidade (city_id, alias_normalized) — decisão humana resolve; sem vencedor automático.' USING ERRCODE = 'raise_exception';
  END IF;

  -- (8) TOKEN one-use por linha; consumido pelo trigger row-level do INSERT
  INSERT INTO public.neighborhood_alias_writer_authorizations (
    xid, backend_pid, operation, manifest_code, manifest_version, manifest_hash, manifest_line_key,
    neighborhood_id, alias_normalized, automation_execution_id
  ) VALUES (
    pg_current_xact_id(), pg_backend_pid(), 'insert_alias', v_appr.manifest_code, v_appr.manifest_version,
    v_appr.manifest_hash, p_manifest_line_key, p_neighborhood_id, v_norm, p_automation_execution_id
  );

  -- (9) INSERT canônico do alias (alias_normalized é GENERATED = normalize_name(alias))
  INSERT INTO public.neighborhood_aliases (
    neighborhood_id, alias, source_kind, source_reference, evidence,
    created_by_actor_id, approved_by_actor_id, approved_at, is_active, valid_from_at, valid_until_at
  ) VALUES (
    p_neighborhood_id, p_alias_text, p_source_kind, p_source_reference, p_evidence,
    v_appr.approved_by_actor_id, v_appr.approved_by_actor_id, now(), true, now(), NULL
  ) RETURNING id INTO v_alias;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'ALIAS_WRITER_CARDINALITY: INSERT canônico deve criar exatamente uma row.' USING ERRCODE = 'raise_exception';
  END IF;

  -- (10) evento alias_created (referencia approval + execution + grant + linha)
  INSERT INTO public.neighborhood_alias_curation_events (
    operation, alias_id, neighborhood_id, city_id, alias_text, alias_normalized,
    manifest_code, manifest_version, manifest_hash, manifest_line_key, manifest_approval_event_id,
    automation_execution_id, approver_actor_id, approver_user_id, territorial_grant_id, capability_key,
    source_kind, source_reference, evidence
  ) VALUES (
    'alias_created', v_alias, p_neighborhood_id, v_nb_city, p_alias_text, v_norm,
    v_appr.manifest_code, v_appr.manifest_version, v_appr.manifest_hash, p_manifest_line_key, p_manifest_approval_event_id,
    p_automation_execution_id, v_appr.approved_by_actor_id, v_appr.approved_by_user_id, v_grant, 'territory:manage_neighborhood_aliases',
    p_source_kind, p_source_reference, p_evidence
  ) RETURNING event_id INTO v_event;

  alias_id := v_alias; curation_event_id := v_event; outcome := 'created'; RETURN NEXT; RETURN;
END;
$func$;
COMMENT ON FUNCTION fn_create_canonical_alias(UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT) IS
  'N1 (§11): writer canônico de alias. SECURITY DEFINER. Carrega+trava approval (manifest_approved, não '
  'revogado/supersedido) → revalida+trava grant (capability exata + Curitiba, = grant do approval) → valida '
  'execução job vinculada → bairro ativo, deriva/prova cidade → recalcula alias_normalized (ignora arquivo) → '
  'rejeita redundância com name_normalized → replay se relação exata já existe → conflito (city, normalized)→bairro '
  'diferente aborta → token one-use por linha → INSERT → evento alias_created. NÃO cria bairro, NÃO escolhe bairro '
  'por texto, sem LIMIT 1/ranking/score, NÃO edita/apaga alias, provider/manifest/status/job nunca são autoridade.';

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 10. ACL — funções internas de trigger sem EXECUTE p/ app/PUBLIC; writers com EXECUTE p/ app na assinatura exata.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
REVOKE ALL ON FUNCTION consume_alias_writer_authorization() FROM PUBLIC;
REVOKE ALL ON FUNCTION consume_alias_writer_authorization() FROM unificard_app;
REVOKE ALL ON FUNCTION assert_alias_writer_token_consumed() FROM PUBLIC;
REVOKE ALL ON FUNCTION assert_alias_writer_token_consumed() FROM unificard_app;
REVOKE ALL ON FUNCTION prevent_alias_governance_house_modification() FROM PUBLIC;
REVOKE ALL ON FUNCTION prevent_alias_governance_house_modification() FROM unificard_app;

REVOKE ALL     ON FUNCTION fn_register_alias_manifest_approval(UUID,UUID,UUID,TEXT,TEXT,TEXT,INTEGER,TEXT,TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION fn_register_alias_manifest_approval(UUID,UUID,UUID,TEXT,TEXT,TEXT,INTEGER,TEXT,TEXT) TO unificard_app;
REVOKE ALL     ON FUNCTION fn_register_alias_automation_execution(UUID,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ,INTEGER,INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION fn_register_alias_automation_execution(UUID,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ,INTEGER,INTEGER) TO unificard_app;
-- writer de alias: o apply-job conecta como owner/operacional (não unificard_app). EXECUTE fechado p/ app e PUBLIC.
REVOKE ALL ON FUNCTION fn_create_canonical_alias(UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_create_canonical_alias(UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT) FROM unificard_app;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 11. FAIL-CLOSED (PÓS) + AUTO-PROVA: writer sem approval válido → TERRITORIAL_CAPABILITY_DENIED; zero resíduo.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v_cnt BIGINT; t TEXT;
BEGIN
  -- 4 casas presentes
  FOREACH t IN ARRAY ARRAY['neighborhood_alias_manifest_events','neighborhood_alias_automation_executions',
                           'neighborhood_alias_curation_events','neighborhood_alias_writer_authorizations'] LOOP
    IF to_regclass('public.'||t) IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: casa % ausente.', t; END IF;
  END LOOP;
  -- HOLD evoluído: statement ENABLE ALWAYS + row-level consume ENABLE ALWAYS
  SELECT count(*) INTO v_cnt FROM pg_trigger WHERE tgrelid='public.neighborhood_aliases'::regclass
   AND tgname='trg_neighborhood_aliases_writer_hold' AND tgenabled='A';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'MIGRATION_ABORT: HOLD statement de aliases não ENABLE ALWAYS.'; END IF;
  SELECT count(*) INTO v_cnt FROM pg_trigger WHERE tgrelid='public.neighborhood_aliases'::regclass
   AND tgname='trg_neighborhood_aliases_writer_token_consume' AND tgenabled='A';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'MIGRATION_ABORT: consume trigger de aliases ausente/não ENABLE ALWAYS.'; END IF;
  -- writer + registradores presentes, SECURITY DEFINER, owner postgres, assinatura única
  SELECT count(*) INTO v_cnt FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
   WHERE p.pronamespace='public'::regnamespace AND p.proname='fn_create_canonical_alias' AND p.prosecdef AND r.rolname='postgres';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'MIGRATION_ABORT: writer ausente/overload/não-SECURITY DEFINER/owner divergente.'; END IF;
  -- ACL: writer sem EXECUTE p/ app nem PUBLIC; registradores COM EXECUTE p/ app
  IF has_function_privilege('unificard_app','public.fn_create_canonical_alias(uuid,uuid,uuid,text,text,text,text,text)','EXECUTE')
     OR has_function_privilege('public','public.fn_create_canonical_alias(uuid,uuid,uuid,text,text,text,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: writer de alias com EXECUTE p/ app/PUBLIC — proibido.';
  END IF;
  IF NOT has_function_privilege('unificard_app','public.fn_register_alias_manifest_approval(uuid,uuid,uuid,text,text,text,integer,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: registrador de approval sem EXECUTE p/ app.';
  END IF;
  -- ACL: app SELECT-only nas 3 casas de evento; nada na token table
  FOREACH t IN ARRAY ARRAY['neighborhood_alias_manifest_events','neighborhood_alias_automation_executions','neighborhood_alias_curation_events'] LOOP
    IF has_table_privilege('unificard_app','public.'||t,'INSERT') OR has_table_privilege('unificard_app','public.'||t,'UPDATE')
       OR has_table_privilege('unificard_app','public.'||t,'DELETE') OR NOT has_table_privilege('unificard_app','public.'||t,'SELECT') THEN
      RAISE EXCEPTION 'MIGRATION_ABORT: ACL de % divergente (esperado SELECT-only).', t;
    END IF;
  END LOOP;
  SELECT count(*) INTO v_cnt FROM information_schema.role_table_grants WHERE table_name='neighborhood_alias_writer_authorizations' AND grantee='unificard_app';
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: app tem privilégio na token table.'; END IF;
  -- token não sobrevive: constraint trigger diferido
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.neighborhood_alias_writer_authorizations'::regclass AND tgname='trg_nawa_must_be_consumed' AND tgdeferrable AND tginitdeferred) THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: constraint trigger de não-sobrevivência do token ausente/não-diferido.';
  END IF;
  -- append-only das 3 casas
  FOREACH t IN ARRAY ARRAY['neighborhood_alias_manifest_events','neighborhood_alias_automation_executions','neighborhood_alias_curation_events'] LOOP
    SELECT count(*) INTO v_cnt FROM pg_trigger WHERE tgrelid=('public.'||t)::regclass AND tgname LIKE 'trg_%_no_modify';
    IF v_cnt <> 1 THEN RAISE EXCEPTION 'MIGRATION_ABORT: append-only de % ausente.', t; END IF;
  END LOOP;

  -- AUTO-PROVA: writer com approval inexistente → denial uniforme; nenhum alias/evento/token/execution criado.
  BEGIN
    PERFORM public.fn_create_canonical_alias(
      gen_random_uuid(), gen_random_uuid(),
      (SELECT neighborhood_id FROM public.neighborhoods ORDER BY neighborhood_id LIMIT 1),
      'Prova Alias', 'internal_curation', 'ref', 'evidencia', 'linha-prova'
    );
    RAISE EXCEPTION 'MIGRATION_ABORT: auto-prova falhou — approval inexistente deveria negar.';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM !~ 'TERRITORIAL_CAPABILITY_DENIED' THEN
      RAISE EXCEPTION 'MIGRATION_ABORT: denial não-uniforme (writer sem approval): %', SQLERRM;
    END IF;
  END;

  -- zero resíduo
  SELECT count(*) INTO v_cnt FROM neighborhood_aliases; IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % alias(es) após auto-prova.', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM neighborhood_alias_manifest_events; IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % manifest event(s).', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM neighborhood_alias_automation_executions; IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % execução(ões).', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM neighborhood_alias_curation_events; IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % evento(s) de alias.', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM neighborhood_alias_writer_authorizations; IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % token(s).', v_cnt; END IF;
  -- núcleo intacto
  SELECT count(*) INTO v_cnt FROM neighborhoods; IF v_cnt <> 75 THEN RAISE EXCEPTION 'MIGRATION_ABORT: neighborhoods=% (esperado 75).', v_cnt; END IF;
END $$;

COMMIT;
