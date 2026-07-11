-- ============================================================
-- F-NEIGHBORHOOD-CANONICAL-IDENTITY / N2-D.2 — KEYS + MATRIZ SCOPE-AWARE + LIFECYCLE APPEND-ONLY
-- DECISION-0173 (§4/§5 keys+maker-checker) + ADENDO D1 (D1.3 atomicidade, D1.4 reason/legado, D1.6
-- trilha) + ADENDO D2 (D2.1 anti-suspended ja seladas na D.1) + ADENDO D3 (matriz scope x capability).
-- ============================================================
-- EVOLUI a casa canonica actor_capability_grants — NUNCA segunda tabela de authority.
--   (1) EXISTENCIA: chk_acg_capability_nonfinancial estendido com as 6 keys territory:*.
--   (2) COMPATIBILIDADE: nova constraint chk_acg_scope_capability_matrix — actor so aceita o
--       conjunto actor-scoped exato; territory so aceita as 6 keys territoriais exatas. A lista
--       plana de existencia NAO e a unica protecao.
--   (3) revoke_reason separado de reason (a concessao nunca e sobrescrita pela revogacao).
--   (4) Grant torna-se IMUTAVEL apos criacao (exceto status/revoked_*/revoke_reason/updated_at);
--       DELETE fisico permanentemente proibido.
--   (5) actor_capability_grant_events — trilha subordinada append-only (molde actor_delegation_events
--       + neighborhood_succession_events): snapshot validado contra o grant pai; cardinalidade
--       (1 granted; no maximo 1 terminal revoked|expired, nunca ambos).
--   (6) 4 funcoes canonicas transacionais (SECURITY DEFINER, search_path pinado, owner postgres):
--       fn_grant_actor_capability (publica, actor-only) · fn_revoke_actor_capability_grant (publica,
--       actor-only) · fn_expire_actor_capability_grant (INTERNA, sem EXECUTE app/PUBLIC, sem rota) ·
--       fn_regrant_actor_capability (INTERNA, sem EXECUTE app/PUBLIC, sem rota; deriva
--       grantee/key/scope/tenant do grant antigo — prova estrutural de "mesmo grantee/key/scope").
--   (7) FRONTEIRA DE ESCRITA: unificard_app perde INSERT/UPDATE/DELETE diretos em
--       actor_capability_grants; so pode SELECT + EXECUTE das 2 funcoes publicas. Eventos: SELECT-only.
-- ESCOPO NEGATIVO: ZERO grant territorial real; ZERO rota nova (create/revoke actor-only preservado;
-- explicit-expire/regrant SEM rota); ZERO hasTerritorialCapability; ZERO PORTA-TERRITORY-1; ZERO
-- writer de bairro; canRepresentActor INTOCADO; Social/Bank FORA. Forward-only; transacao unica.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- FAIL-CLOSED (PRE): aborta se o terreno nao for exatamente o esperado.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_cnt BIGINT;
  v_def TEXT;
BEGIN
  IF to_regclass('public.actor_capability_grants') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: actor_capability_grants ausente.';
  END IF;

  -- shape da N2-D.1 intacto (pre-requisito)
  SELECT count(*) INTO v_cnt FROM pg_constraint WHERE conrelid='public.actor_capability_grants'::regclass
   AND conname IN ('chk_acg_scope_shape','chk_acg_territory_not_suspended','fk_acg_scope_city','chk_acg_scope_type');
  IF v_cnt <> 4 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: shape da N2-D.1 incompleto/divergente (achado % de 4 constraints).', v_cnt;
  END IF;
  SELECT count(*) INTO v_cnt FROM pg_indexes WHERE schemaname='public'
   AND indexname IN ('uidx_actor_capability_grants_active','uidx_actor_capability_grants_territory_active');
  IF v_cnt <> 2 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: indices da N2-D.1 incompletos/divergentes.';
  END IF;

  -- allowlist de existencia ainda nao estendida (6 keys originais, sem territory:*)
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid='public.actor_capability_grants'::regclass AND conname='chk_acg_capability_nonfinancial';
  IF v_def IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_capability_nonfinancial ausente.'; END IF;
  IF v_def ~ 'territory:' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: allowlist ja contem territory:* — estado divergente/reaplicacao.';
  END IF;

  -- objetos da D.2 ainda nao existem (idempotencia contra reaplicacao com estado divergente)
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='actor_capability_grants' AND column_name='revoke_reason') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: revoke_reason ja existe — estado divergente.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.actor_capability_grants'::regclass
              AND conname IN ('chk_acg_scope_capability_matrix','chk_acg_revoke_reason_shape')) THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: constraint da matriz/revoke_reason ja existe — estado divergente.';
  END IF;
  IF to_regclass('public.actor_capability_grant_events') IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: actor_capability_grant_events ja existe — estado divergente.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace
              AND proname IN ('fn_grant_actor_capability','fn_revoke_actor_capability_grant',
                               'fn_expire_actor_capability_grant','fn_regrant_actor_capability')) THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: funcoes canonicas da D.2 ja existem — estado divergente.';
  END IF;

  -- zero grants vivos (nada a corrigir/backfillar; nenhuma correcao silenciosa de legado)
  SELECT count(*) INTO v_cnt FROM actor_capability_grants;
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: % row(s) em actor_capability_grants — legado nao previsto; STOP conforme GO (secao 21).', v_cnt;
  END IF;

  -- ACL vivo (registro do estado pre-fatia; a brecha sera fechada abaixo)
  SELECT count(*) INTO v_cnt FROM information_schema.role_table_grants
   WHERE table_name='actor_capability_grants' AND grantee='unificard_app'
     AND privilege_type IN ('INSERT','UPDATE','DELETE');
  IF v_cnt <> 3 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: ACL de unificard_app divergente do esperado pre-fatia (INSERT/UPDATE/DELETE=3, achado %).', v_cnt;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. EXISTENCIA: allowlist estendida com as 6 keys territoriais (espelha permission-keys.ts).
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE actor_capability_grants
  DROP CONSTRAINT chk_acg_capability_nonfinancial;

ALTER TABLE actor_capability_grants
  ADD CONSTRAINT chk_acg_capability_nonfinancial CHECK (
    capability_key IN (
      'calendar:block',
      'calendar:unblock',
      'services:create',
      'services:edit',
      'services:disable',
      'service_order:view',
      'territory:create_neighborhood',
      'territory:approve_neighborhood',
      'territory:correct_neighborhood',
      'territory:deactivate_neighborhood',
      'territory:manage_neighborhood_aliases',
      'territory:register_neighborhood_succession'
    )
  );

COMMENT ON CONSTRAINT chk_acg_capability_nonfinancial ON actor_capability_grants IS
  'N2-D.2 (DECISION-0173 ADENDO D3): existencia fisica das 12 keys concediveis (6 actor-scoped + 6 territory:*). Espelho defensivo de permission-keys.ts. NAO decide COMPATIBILIDADE de escopo — isso e chk_acg_scope_capability_matrix. PROIBIDO conter capability financeira.';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. COMPATIBILIDADE: matriz fechada scope_type x capability_key (ADENDO D3 §D3.4/D3.5).
--    Actor so aceita o conjunto actor-scoped exato; territory so aceita as 6 keys territoriais.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE actor_capability_grants
  ADD CONSTRAINT chk_acg_scope_capability_matrix CHECK (
    (
      scope_type = 'actor'
      AND capability_key IN (
        'calendar:block',
        'calendar:unblock',
        'services:create',
        'services:edit',
        'services:disable',
        'service_order:view'
      )
    )
    OR
    (
      scope_type = 'territory'
      AND capability_key IN (
        'territory:create_neighborhood',
        'territory:approve_neighborhood',
        'territory:correct_neighborhood',
        'territory:deactivate_neighborhood',
        'territory:manage_neighborhood_aliases',
        'territory:register_neighborhood_succession'
      )
    )
  );

COMMENT ON CONSTRAINT chk_acg_scope_capability_matrix ON actor_capability_grants IS
  'N2-D.2 (DECISION-0173 ADENDO D3): matriz FECHADA scope_type x capability_key. Correspondencia por conjuntos EXATOS, nunca prefixo/wildcard. Coexiste com chk_acg_scope_shape (D.1) e chk_acg_territory_not_suspended (D.1/D2.1) e chk_acg_capability_nonfinancial (existencia).';

-- ────────────────────────────────────────────────────────────────────────────
-- 3. revoke_reason separado de reason (ADENDO D1.4 + D2.2).
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE actor_capability_grants
  ADD COLUMN revoke_reason TEXT NULL;

ALTER TABLE actor_capability_grants
  ADD CONSTRAINT chk_acg_revoke_reason_shape CHECK (
    (
      status = 'revoked'
      AND revoked_at IS NOT NULL
      AND revoked_by_actor_id IS NOT NULL
      AND revoke_reason IS NOT NULL
      AND revoke_reason ~ '[^[:space:]]'
    )
    OR
    (
      status <> 'revoked'
      AND revoked_at IS NULL
      AND revoked_by_actor_id IS NULL
      AND revoke_reason IS NULL
    )
  );

COMMENT ON COLUMN actor_capability_grants.revoke_reason IS
  'N2-D.2 (ADENDO D1.4/D2.2): motivo PROPRIO da revogacao. reason (concessao) NUNCA e sobrescrito por revoke_reason. Preenchido SOMENTE por fn_revoke_actor_capability_grant, junto com revoked_at/revoked_by_actor_id, na mesma transacao do evento revoked.';

-- ────────────────────────────────────────────────────────────────────────────
-- 4. IMUTABILIDADE do grant apos criacao (GO §12). DELETE fisico permanentemente proibido.
--    Mutaveis apos criacao: status, revoked_at, revoked_by_actor_id, revoke_reason, updated_at.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION enforce_actor_capability_grant_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $func$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'ACTOR_CAPABILITY_GRANT_DELETE_FORBIDDEN: actor_capability_grants nao admite exclusao fisica (DECISION-0173 N2-D.2 secao 12). Regrant = nova row com novo grant_id.';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.grant_id IS DISTINCT FROM OLD.grant_id
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.grantee_actor_id IS DISTINCT FROM OLD.grantee_actor_id
       OR NEW.capability_key IS DISTINCT FROM OLD.capability_key
       OR NEW.scope_type IS DISTINCT FROM OLD.scope_type
       OR NEW.scope_actor_id IS DISTINCT FROM OLD.scope_actor_id
       OR NEW.scope_city_id IS DISTINCT FROM OLD.scope_city_id
       OR NEW.granted_by_user_id IS DISTINCT FROM OLD.granted_by_user_id
       OR NEW.granted_by_actor_id IS DISTINCT FROM OLD.granted_by_actor_id
       OR NEW.authority_source IS DISTINCT FROM OLD.authority_source
       OR NEW.reason IS DISTINCT FROM OLD.reason
       OR NEW.valid_from IS DISTINCT FROM OLD.valid_from
       OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'ACTOR_CAPABILITY_GRANT_IMMUTABLE_FIELD_CHANGED: somente status/revoked_at/revoked_by_actor_id/revoke_reason/updated_at sao mutaveis apos a criacao (DECISION-0173 N2-D.2 secao 12).';
    END IF;
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$func$;

CREATE TRIGGER trg_acg_immutability
  BEFORE UPDATE OR DELETE ON actor_capability_grants
  FOR EACH ROW EXECUTE FUNCTION enforce_actor_capability_grant_immutability();

COMMENT ON TRIGGER trg_acg_immutability ON actor_capability_grants IS
  'N2-D.2: DELETE fisico permanentemente proibido; campos de identidade/proveniencia imutaveis apos criacao. Regrant = nova row.';

-- ────────────────────────────────────────────────────────────────────────────
-- 5. TRILHA SUBORDINADA APPEND-ONLY — actor_capability_grant_events (molde
--    actor_delegation_events + neighborhood_succession_events). NAO decide se o grant existe/vale.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE actor_capability_grant_events (
  event_id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id                    UUID NOT NULL REFERENCES actor_capability_grants (grant_id) ON DELETE RESTRICT,
  event_type                  TEXT NOT NULL CHECK (event_type IN ('granted', 'revoked', 'expired')),
  grantee_actor_id            UUID NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
  capability_key              TEXT NOT NULL,
  scope_type                  TEXT NOT NULL,
  tenant_id                   UUID NULL REFERENCES tenants (id) ON DELETE RESTRICT,
  scope_actor_id              UUID NULL REFERENCES actors (id) ON DELETE RESTRICT,
  scope_city_id                UUID NULL REFERENCES cities (city_id) ON DELETE RESTRICT,
  valid_from                  TIMESTAMPTZ NOT NULL,
  valid_until                 TIMESTAMPTZ NULL,
  authority_source            TEXT NOT NULL,
  executed_by_user_id         UUID NOT NULL,
  executed_by_actor_id        UUID NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
  responsible_human_actor_id  UUID NOT NULL REFERENCES actors (id) ON DELETE RESTRICT,
  event_reason                TEXT NOT NULL,
  occurred_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_acge_event_reason_nonempty CHECK (event_reason ~ '[^[:space:]]'),
  CONSTRAINT uq_acge_grant_event_type UNIQUE (grant_id, event_type)
);

-- Cardinalidade: no maximo UM evento TERMINAL (revoked|expired) por grant — mutuamente exclusivos.
CREATE UNIQUE INDEX uidx_acge_one_terminal_event
  ON actor_capability_grant_events (grant_id)
  WHERE event_type IN ('revoked', 'expired');

COMMENT ON TABLE actor_capability_grant_events IS
  'N2-D.2 (DECISION-0173 ADENDO D1.3/D1.6): trilha append-only do lifecycle de actor_capability_grants (granted/revoked/expired). Subordinada — nao e segunda casa de authority; nao decide se o grant existe ou vale. Snapshot validado contra o grant pai (trg_acge_snapshot). UPDATE/DELETE bloqueados permanentemente.';
COMMENT ON INDEX uidx_acge_one_terminal_event IS
  'N2-D.2: revoked e expired sao mutuamente exclusivos como eventos terminais — no maximo um por grant.';

-- Snapshot: o evento deve coincidir EXATAMENTE com o grant pai no momento do INSERT — impede evento
-- fabricado com escopo/key diferentes (GO secao 10).
CREATE OR REPLACE FUNCTION enforce_actor_capability_grant_event_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $func$
DECLARE
  v_grant public.actor_capability_grants%ROWTYPE;
BEGIN
  SELECT * INTO v_grant FROM public.actor_capability_grants WHERE grant_id = NEW.grant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTOR_CAPABILITY_GRANT_EVENT_ORPHAN: grant_id % nao existe em actor_capability_grants.', NEW.grant_id;
  END IF;
  IF NEW.grantee_actor_id IS DISTINCT FROM v_grant.grantee_actor_id
     OR NEW.capability_key IS DISTINCT FROM v_grant.capability_key
     OR NEW.scope_type IS DISTINCT FROM v_grant.scope_type
     OR NEW.tenant_id IS DISTINCT FROM v_grant.tenant_id
     OR NEW.scope_actor_id IS DISTINCT FROM v_grant.scope_actor_id
     OR NEW.scope_city_id IS DISTINCT FROM v_grant.scope_city_id
     OR NEW.valid_from IS DISTINCT FROM v_grant.valid_from
     OR NEW.valid_until IS DISTINCT FROM v_grant.valid_until
     OR NEW.authority_source IS DISTINCT FROM v_grant.authority_source
  THEN
    RAISE EXCEPTION 'ACTOR_CAPABILITY_GRANT_EVENT_SNAPSHOT_MISMATCH: evento diverge do grant pai (DECISION-0173 N2-D.2 secao 10) — evento fabricado com escopo/key diferentes e proibido.';
  END IF;
  RETURN NEW;
END;
$func$;

CREATE TRIGGER trg_acge_snapshot
  BEFORE INSERT ON actor_capability_grant_events
  FOR EACH ROW EXECUTE FUNCTION enforce_actor_capability_grant_event_snapshot();

-- Append-only: UPDATE/DELETE bloqueados permanentemente (mesmo padrao de actor_delegation_events).
CREATE OR REPLACE FUNCTION prevent_actor_capability_grant_events_modification()
RETURNS trigger AS $func$
BEGIN
  RAISE EXCEPTION 'ACTOR_CAPABILITY_GRANT_EVENT_APPEND_ONLY: actor_capability_grant_events e append-only. UPDATE ou DELETE nao sao permitidos.';
END;
$func$ LANGUAGE plpgsql;

CREATE TRIGGER trg_acge_no_update
  BEFORE UPDATE ON actor_capability_grant_events
  FOR EACH ROW EXECUTE FUNCTION prevent_actor_capability_grant_events_modification();

CREATE TRIGGER trg_acge_no_delete
  BEFORE DELETE ON actor_capability_grant_events
  FOR EACH ROW EXECUTE FUNCTION prevent_actor_capability_grant_events_modification();

-- ────────────────────────────────────────────────────────────────────────────
-- 6. FUNCOES CANONICAS TRANSACIONAIS (SECURITY DEFINER, owner=postgres, search_path pinado).
--    Estado + evento SEMPRE na MESMA transacao (funcao unica) — atomicidade por construcao.
-- ────────────────────────────────────────────────────────────────────────────

-- A. CREATE ACTOR-SCOPED (publica) — usada pelas rotas existentes. Nao aceita scope_type/scope_city_id
--    do cliente; scope_type='actor' e fixo internamente.
CREATE FUNCTION fn_grant_actor_capability(
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
  'N2-D.2: cria grant actor-scoped (state+evento granted atomico). PUBLICA — EXECUTE concedido a unificard_app. scope_type=actor fixo internamente; nao aceita scope_city_id do chamador.';

-- B. REVOKE CANONICO (publica) — usada pelas rotas existentes. Actor-only: nao revoga grant territory.
CREATE FUNCTION fn_revoke_actor_capability_grant(
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
  SELECT * INTO v_grant FROM public.actor_capability_grants WHERE grant_id = p_grant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTOR_CAPABILITY_GRANT_NOT_FOUND: grant % nao existe.', p_grant_id;
  END IF;
  IF v_grant.scope_type <> 'actor' THEN
    RAISE EXCEPTION 'ACTOR_CAPABILITY_GRANT_REVOKE_SCOPE_MISMATCH: revoke canonico e actor-only (grant % e %).', p_grant_id, v_grant.scope_type;
  END IF;
  IF v_grant.status <> 'active' THEN
    RAISE EXCEPTION 'ACTOR_CAPABILITY_GRANT_NOT_ACTIVE: grant % nao esta active (status atual: %).', p_grant_id, v_grant.status;
  END IF;

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

COMMENT ON FUNCTION fn_revoke_actor_capability_grant(UUID,UUID,UUID,UUID,TEXT) IS
  'N2-D.2: revoga grant actor-scoped (state+evento revoked atomico). PUBLICA — EXECUTE concedido a unificard_app. reason da concessao NUNCA e alterado; revoke_reason e campo proprio. Rejeita scope_type=territory (contrato proprio futuro).';

-- C. EXPLICIT-EXPIRE (INTERNA — sem rota, sem EXECUTE app/PUBLIC).
CREATE FUNCTION fn_expire_actor_capability_grant(
  p_grant_id                   UUID,
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
  SELECT * INTO v_grant FROM public.actor_capability_grants WHERE grant_id = p_grant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTOR_CAPABILITY_GRANT_NOT_FOUND: grant % nao existe.', p_grant_id;
  END IF;
  IF v_grant.status <> 'active' THEN
    RAISE EXCEPTION 'ACTOR_CAPABILITY_GRANT_EXPIRE_NOT_ACTIVE: grant % nao esta active (status atual: %).', p_grant_id, v_grant.status;
  END IF;
  IF v_grant.valid_until IS NULL THEN
    RAISE EXCEPTION 'ACTOR_CAPABILITY_GRANT_EXPIRE_NO_VALID_UNTIL: grant % sem vigencia definida nao pode ser expirado explicitamente.', p_grant_id;
  END IF;
  IF v_grant.valid_until > now() THEN
    RAISE EXCEPTION 'ACTOR_CAPABILITY_GRANT_EXPIRE_STILL_VALID: grant % ainda vigente (valid_until %).', p_grant_id, v_grant.valid_until;
  END IF;

  UPDATE public.actor_capability_grants
     SET status = 'expired', updated_at = now()
   WHERE grant_id = p_grant_id
  RETURNING * INTO v_grant;

  INSERT INTO public.actor_capability_grant_events (
    grant_id, event_type, grantee_actor_id, capability_key, scope_type, tenant_id, scope_actor_id, scope_city_id,
    valid_from, valid_until, authority_source, executed_by_user_id, executed_by_actor_id, responsible_human_actor_id, event_reason
  ) VALUES (
    v_grant.grant_id, 'expired', v_grant.grantee_actor_id, v_grant.capability_key, v_grant.scope_type, v_grant.tenant_id,
    v_grant.scope_actor_id, v_grant.scope_city_id, v_grant.valid_from, v_grant.valid_until, v_grant.authority_source,
    p_executed_by_user_id, p_executed_by_actor_id, p_responsible_human_actor_id, p_event_reason
  );

  RETURN v_grant;
END;
$func$;

COMMENT ON FUNCTION fn_expire_actor_capability_grant(UUID,UUID,UUID,UUID,TEXT) IS
  'N2-D.2: explicit-expire (state+evento expired atomico). INTERNA — sem rota publica, EXECUTE NAO concedido a unificard_app/PUBLIC. Falha se ainda vigente ou nao-active. Nunca toca revoked_at/revoked_by_actor_id/revoke_reason.';

-- D. REGRANT (INTERNA — sem rota, sem EXECUTE app/PUBLIC). Deriva grantee/key/scope/tenant/
--    authority_source do grant ANTIGO — prova estrutural de "mesmo grantee/key/scope" (sem campo
--    para o caller divergir). Explicit-expire do antigo + criacao do novo, tudo atomico.
CREATE FUNCTION fn_regrant_actor_capability(
  p_old_grant_id                UUID,
  p_new_valid_until             TIMESTAMPTZ,
  p_new_reason                  TEXT,
  p_executed_by_user_id         UUID,
  p_executed_by_actor_id        UUID,
  p_responsible_human_actor_id  UUID,
  p_event_reason                TEXT
) RETURNS public.actor_capability_grants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $func$
DECLARE
  v_old public.actor_capability_grants%ROWTYPE;
  v_new public.actor_capability_grants%ROWTYPE;
BEGIN
  SELECT * INTO v_old FROM public.actor_capability_grants WHERE grant_id = p_old_grant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTOR_CAPABILITY_GRANT_NOT_FOUND: grant % nao existe.', p_old_grant_id;
  END IF;

  -- explicit-expire atomico do antigo, na MESMA transacao (reusa validacao/gravacao/evento).
  v_old := public.fn_expire_actor_capability_grant(
    p_old_grant_id, p_executed_by_user_id, p_executed_by_actor_id, p_responsible_human_actor_id, p_event_reason
  );

  INSERT INTO public.actor_capability_grants (
    tenant_id, grantee_actor_id, capability_key, scope_type, scope_actor_id, scope_city_id,
    granted_by_user_id, granted_by_actor_id, authority_source, status, valid_from, valid_until, reason
  ) VALUES (
    v_old.tenant_id, v_old.grantee_actor_id, v_old.capability_key, v_old.scope_type, v_old.scope_actor_id, v_old.scope_city_id,
    p_executed_by_user_id, p_executed_by_actor_id, v_old.authority_source, 'active', now(), p_new_valid_until, p_new_reason
  ) RETURNING * INTO v_new;

  INSERT INTO public.actor_capability_grant_events (
    grant_id, event_type, grantee_actor_id, capability_key, scope_type, tenant_id, scope_actor_id, scope_city_id,
    valid_from, valid_until, authority_source, executed_by_user_id, executed_by_actor_id, responsible_human_actor_id, event_reason
  ) VALUES (
    v_new.grant_id, 'granted', v_new.grantee_actor_id, v_new.capability_key, v_new.scope_type, v_new.tenant_id,
    v_new.scope_actor_id, v_new.scope_city_id, v_new.valid_from, v_new.valid_until, v_new.authority_source,
    p_executed_by_user_id, p_executed_by_actor_id, p_responsible_human_actor_id, p_event_reason
  );

  RETURN v_new;
END;
$func$;

COMMENT ON FUNCTION fn_regrant_actor_capability(UUID,TIMESTAMPTZ,TEXT,UUID,UUID,UUID,TEXT) IS
  'N2-D.2: regrant (explicit-expire do antigo + novo grant, atomico). INTERNA — sem rota publica, EXECUTE NAO concedido a unificard_app/PUBLIC. grantee/key/scope/tenant/authority_source DERIVADOS do antigo (sem parametro para divergir). Sem ON CONFLICT; sem reciclar row.';

-- ────────────────────────────────────────────────────────────────────────────
-- 7. FRONTEIRA DE ESCRITA / ACL — fecha a brecha de DML direto (GO secao 13).
-- ────────────────────────────────────────────────────────────────────────────
REVOKE INSERT, UPDATE, DELETE ON actor_capability_grants FROM unificard_app;
REVOKE ALL ON actor_capability_grants FROM PUBLIC;

REVOKE ALL ON actor_capability_grant_events FROM unificard_app;
REVOKE ALL ON actor_capability_grant_events FROM PUBLIC;
GRANT SELECT ON actor_capability_grant_events TO unificard_app;

-- NOTA (achada em prova): default privilege de schema (pg_default_acl, postgres/public/f) auto-concede
-- EXECUTE a unificard_app em TODA funcao nova no momento do CREATE FUNCTION. Para as duas funcoes
-- INTERNAS, o REVOKE de PUBLIC nao basta — e preciso REVOKE explicito de unificard_app tambem.
REVOKE EXECUTE ON FUNCTION fn_grant_actor_capability(UUID,UUID,TEXT,UUID,UUID,UUID,TEXT,TIMESTAMPTZ,TEXT,UUID,UUID,UUID,TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_revoke_actor_capability_grant(UUID,UUID,UUID,UUID,TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_expire_actor_capability_grant(UUID,UUID,UUID,UUID,TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_regrant_actor_capability(UUID,TIMESTAMPTZ,TEXT,UUID,UUID,UUID,TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fn_expire_actor_capability_grant(UUID,UUID,UUID,UUID,TEXT) FROM unificard_app;
REVOKE EXECUTE ON FUNCTION fn_regrant_actor_capability(UUID,TIMESTAMPTZ,TEXT,UUID,UUID,UUID,TEXT) FROM unificard_app;

GRANT EXECUTE ON FUNCTION fn_grant_actor_capability(UUID,UUID,TEXT,UUID,UUID,UUID,TEXT,TIMESTAMPTZ,TEXT,UUID,UUID,UUID,TEXT) TO unificard_app;
GRANT EXECUTE ON FUNCTION fn_revoke_actor_capability_grant(UUID,UUID,UUID,UUID,TEXT) TO unificard_app;
-- fn_expire_actor_capability_grant e fn_regrant_actor_capability: SEM EXECUTE a unificard_app/PUBLIC
-- (internas; sem rota publica nesta fatia).

-- ────────────────────────────────────────────────────────────────────────────
-- FAIL-CLOSED (POS): prova o shape final; aborta (rollback total) se divergir.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_cnt BIGINT;
  v_def TEXT;
BEGIN
  -- existencia: 12 keys exatas
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid='public.actor_capability_grants'::regclass AND conname='chk_acg_capability_nonfinancial' AND convalidated;
  IF v_def IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_capability_nonfinancial ausente/NOT VALID.'; END IF;
  IF v_def !~ 'territory:create_neighborhood' OR v_def !~ 'territory:register_neighborhood_succession' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: allowlist de existencia nao contem as 6 keys territoriais.';
  END IF;

  -- matriz: validada, cobre os dois ramos
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid='public.actor_capability_grants'::regclass AND conname='chk_acg_scope_capability_matrix' AND convalidated;
  IF v_def IS NULL THEN RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_scope_capability_matrix ausente/NOT VALID.'; END IF;
  IF v_def !~ $re$scope_type = 'actor'$re$ OR v_def !~ $re$scope_type = 'territory'$re$ THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: matriz nao cobre os dois ramos de scope.';
  END IF;

  -- revoke_reason + shape
  SELECT count(*) INTO v_cnt FROM information_schema.columns
   WHERE table_schema='public' AND table_name='actor_capability_grants' AND column_name='revoke_reason' AND data_type='text';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'MIGRATION_ABORT: revoke_reason ausente/tipo errado.'; END IF;
  SELECT count(*) INTO v_cnt FROM pg_constraint
   WHERE conrelid='public.actor_capability_grants'::regclass AND conname='chk_acg_revoke_reason_shape' AND convalidated;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'MIGRATION_ABORT: chk_acg_revoke_reason_shape ausente/NOT VALID.'; END IF;

  -- imutabilidade
  SELECT count(*) INTO v_cnt FROM pg_trigger
   WHERE tgrelid='public.actor_capability_grants'::regclass AND tgname='trg_acg_immutability' AND tgenabled = 'O';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'MIGRATION_ABORT: trg_acg_immutability ausente/desabilitado.'; END IF;

  -- tabela de eventos: shape + FKs + cardinalidade + triggers
  IF to_regclass('public.actor_capability_grant_events') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: actor_capability_grant_events ausente.';
  END IF;
  SELECT count(*) INTO v_cnt FROM information_schema.columns
   WHERE table_schema='public' AND table_name='actor_capability_grant_events';
  IF v_cnt <> 17 THEN RAISE EXCEPTION 'MIGRATION_ABORT: shape de actor_capability_grant_events divergente (% colunas).', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM pg_constraint WHERE conrelid='public.actor_capability_grant_events'::regclass AND contype='f';
  IF v_cnt <> 7 THEN RAISE EXCEPTION 'MIGRATION_ABORT: FKs de actor_capability_grant_events divergentes (% de 7).', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM pg_constraint WHERE conrelid='public.actor_capability_grant_events'::regclass
   AND conname='uq_acge_grant_event_type' AND contype='u';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'MIGRATION_ABORT: uq_acge_grant_event_type ausente.'; END IF;
  SELECT count(*) INTO v_cnt FROM pg_indexes WHERE schemaname='public' AND indexname='uidx_acge_one_terminal_event';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'MIGRATION_ABORT: uidx_acge_one_terminal_event ausente.'; END IF;
  SELECT count(*) INTO v_cnt FROM pg_trigger WHERE tgrelid='public.actor_capability_grant_events'::regclass AND NOT tgisinternal;
  IF v_cnt <> 3 THEN RAISE EXCEPTION 'MIGRATION_ABORT: triggers de eventos divergentes (% de 3: snapshot+no_update+no_delete).', v_cnt; END IF;

  -- 4 funcoes existem, SECURITY DEFINER, owner postgres
  SELECT count(*) INTO v_cnt FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner
   WHERE p.pronamespace='public'::regnamespace AND r.rolname='postgres' AND p.prosecdef
     AND p.proname IN ('fn_grant_actor_capability','fn_revoke_actor_capability_grant',
                        'fn_expire_actor_capability_grant','fn_regrant_actor_capability');
  IF v_cnt <> 4 THEN RAISE EXCEPTION 'MIGRATION_ABORT: funcoes canonicas incompletas/nao SECURITY DEFINER/owner divergente (% de 4).', v_cnt; END IF;

  -- ACL: app perdeu DML direto na tabela de grants; mantem SELECT
  SELECT count(*) INTO v_cnt FROM information_schema.role_table_grants
   WHERE table_name='actor_capability_grants' AND grantee='unificard_app' AND privilege_type IN ('INSERT','UPDATE','DELETE');
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: unificard_app ainda tem DML direto em actor_capability_grants.'; END IF;
  SELECT count(*) INTO v_cnt FROM information_schema.role_table_grants
   WHERE table_name='actor_capability_grants' AND grantee='unificard_app' AND privilege_type='SELECT';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'MIGRATION_ABORT: unificard_app perdeu SELECT em actor_capability_grants.'; END IF;

  -- ACL: eventos SELECT-only para app; zero para PUBLIC
  SELECT count(*) INTO v_cnt FROM information_schema.role_table_grants
   WHERE table_name='actor_capability_grant_events' AND grantee='unificard_app';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'MIGRATION_ABORT: ACL de eventos para unificard_app divergente (esperado SOMENTE SELECT).'; END IF;
  SELECT count(*) INTO v_cnt FROM information_schema.role_table_grants
   WHERE table_name IN ('actor_capability_grants','actor_capability_grant_events') AND grantee='PUBLIC';
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: PUBLIC possui privilegio em grants/eventos.'; END IF;

  -- EXECUTE: app SOMENTE nas 2 funcoes publicas; zero PUBLIC em qualquer funcao
  SELECT count(*) INTO v_cnt FROM information_schema.role_routine_grants
   WHERE routine_name IN ('fn_grant_actor_capability','fn_revoke_actor_capability_grant') AND grantee='unificard_app';
  IF v_cnt <> 2 THEN RAISE EXCEPTION 'MIGRATION_ABORT: EXECUTE de unificard_app nas funcoes publicas divergente (% de 2).', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM information_schema.role_routine_grants
   WHERE routine_name IN ('fn_expire_actor_capability_grant','fn_regrant_actor_capability') AND grantee='unificard_app';
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: unificard_app possui EXECUTE em funcao interna (expire/regrant).'; END IF;
  SELECT count(*) INTO v_cnt FROM information_schema.role_routine_grants
   WHERE routine_name IN ('fn_grant_actor_capability','fn_revoke_actor_capability_grant',
                           'fn_expire_actor_capability_grant','fn_regrant_actor_capability') AND grantee='PUBLIC';
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: PUBLIC possui EXECUTE em funcao canonica.'; END IF;

  -- zero grants/eventos reais nesta fatia
  SELECT count(*) INTO v_cnt FROM actor_capability_grants;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % grant(s) real(is) — seed proibido na N2-D.2.', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM actor_capability_grant_events;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'MIGRATION_ABORT: % evento(s) real(is) — seed proibido na N2-D.2.', v_cnt; END IF;

  -- shape da D.1 preservado (anti-suspended/FK/indices intactos)
  SELECT count(*) INTO v_cnt FROM pg_constraint WHERE conrelid='public.actor_capability_grants'::regclass
   AND conname IN ('chk_acg_scope_shape','chk_acg_territory_not_suspended','fk_acg_scope_city','chk_acg_scope_type');
  IF v_cnt <> 4 THEN RAISE EXCEPTION 'MIGRATION_ABORT: shape da N2-D.1 foi alterado — proibido.'; END IF;
END $$;

COMMIT;
