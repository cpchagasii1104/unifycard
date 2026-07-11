-- 20260711150000_neighborhood_succession_foundation.sql
-- F-NEIGHBORHOOD-CANONICAL-IDENTITY · N2-C — FUNDAÇÃO DE SUCESSÃO TERRITORIAL N:N APPEND-ONLY.
-- DECISION-0171 §3-E/§9 (sucessão N:N append-only; linhagem, não segunda identidade) +
-- DECISION-0172 §2 (rename ≠ sucessão).
--
-- O QUE ESTA MIGRATION FAZ (e SOMENTE isto):
--   1. tres tabelas GLOBAIS: neighborhood_succession_events (o evento + evidencia),
--      neighborhood_succession_sources (N predecessores), neighborhood_succession_targets (N sucessores);
--   2. cardinalidade governada por CONSTRAINT TRIGGER DEFERRABLE INITIALLY DEFERRED
--      (division 1→N, merger N→1, reorganization N→N com >1 de um lado, extinction N→0);
--   3. append-only permanente (UPDATE/DELETE bloqueados);
--   4. HOLD fisico temporario (sem writer ate N2-E) + ACL SELECT-only;
--   5. verificacoes fail-closed.
--
-- O QUE ELA NAO FAZ: nenhum writer/evento real/seed; nenhum efeito automatico sobre neighborhoods
-- (is_active/valid_until_at), aliases, addresses, posts, audiencia, voto, representacao, authority,
-- fundo regional, Social ou Bank; nao corrige neighborhoods.name (trava independente pre-N2-E/N3);
-- nao toca HOLD/ACL do nucleo nem de aliases.
--
-- SEMANTICA VINCULANTE: sucessao e LINHAGEM HISTORICA. NAO muda retrospectivamente FKs; cada
-- consumidor decide o efeito por contrato PROPRIO. Registro financeiro/residencia/publicacao
-- historica permanece vinculado ao neighborhood_id que existia no snapshot. Rename/correcao
-- preservam o mesmo neighborhood_id e pertencem ao fluxo nome+alias — NAO a sucessao.
-- Escopo same-city (MVP): FKs compostas tornam sucessao cross-city impossivel.
--
-- Guard: audit-neighborhood-succession-foundation.mjs.

BEGIN;

-- ── 0. FAIL-CLOSED PRÉ ───────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_hn "char"; v_ha "char"; v_in "char"; v_ia "char";
BEGIN
  IF to_regclass('public.neighborhoods') IS NULL OR to_regclass('public.neighborhood_aliases') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: nucleo/aliases ausentes';
  END IF;
  IF (SELECT count(*) FROM neighborhoods) <> 0 OR (SELECT count(*) FROM neighborhood_aliases) <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: catalogos deveriam estar VAZIOS';
  END IF;
  IF to_regclass('public.neighborhood_succession_events') IS NOT NULL
     OR to_regclass('public.neighborhood_succession_sources') IS NOT NULL
     OR to_regclass('public.neighborhood_succession_targets') IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: tabela de sucessao ja existe';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename ~ 'neighborhood.*(success|lineage|history|merge|split|predecessor)') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: tabela de sucessao/lineage concorrente detectada';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='neighborhoods'
             AND column_name ~ 'superseded|predecessor|successor') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: coluna superseded_by no nucleo — sucessao nao e coluna singular';
  END IF;
  -- suporte da FK composta same-city
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='neighborhoods'
                 AND indexname='uq_neighborhoods_city_neighborhood') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: unique (city_id,neighborhood_id) ausente';
  END IF;
  SELECT tgenabled INTO v_hn FROM pg_trigger WHERE tgrelid='public.neighborhoods'::regclass AND tgname='trg_neighborhoods_canonical_writer_hold';
  SELECT tgenabled INTO v_ha FROM pg_trigger WHERE tgrelid='public.neighborhood_aliases'::regclass AND tgname='trg_neighborhood_aliases_writer_hold';
  SELECT tgenabled INTO v_in FROM pg_trigger WHERE tgrelid='public.neighborhoods'::regclass AND tgname='trg_neighborhood_identity_immutability';
  SELECT tgenabled INTO v_ia FROM pg_trigger WHERE tgrelid='public.neighborhood_aliases'::regclass AND tgname='trg_neighborhood_alias_identity_immutability';
  IF v_hn IS DISTINCT FROM 'A' OR v_ha IS DISTINCT FROM 'A' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: HOLD nucleo/alias nao esta ENABLE ALWAYS';
  END IF;
  IF v_in NOT IN ('O','A') OR v_ia NOT IN ('O','A') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: imutabilidade nucleo/alias rebaixada';
  END IF;
  IF has_table_privilege('unificard_app','public.neighborhoods','INSERT')
     OR has_table_privilege('unificard_app','public.neighborhood_aliases','INSERT') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: ACL nucleo/alias divergente';
  END IF;
END $$;

-- ── 1. EVENTO ────────────────────────────────────────────────────────────────────────────────
CREATE TABLE neighborhood_succession_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL
    CONSTRAINT fk_nse_city REFERENCES cities(city_id) ON DELETE RESTRICT,
  succession_type TEXT NOT NULL
    CONSTRAINT chk_nse_succession_type
    CHECK (succession_type IN ('division', 'merger', 'reorganization', 'extinction')),
  effective_at TIMESTAMPTZ NOT NULL,
  source_kind TEXT NOT NULL
    CONSTRAINT chk_nse_source_kind
    CHECK (source_kind IN ('government_official', 'public_documentary', 'internal_curation')),
  source_reference TEXT NOT NULL
    CONSTRAINT chk_nse_source_reference_nonempty CHECK (source_reference ~ '[^[:space:]]'),
  evidence TEXT NOT NULL
    CONSTRAINT chk_nse_evidence_nonempty CHECK (evidence ~ '[^[:space:]]'),
  created_by_actor_id UUID NOT NULL
    CONSTRAINT fk_nse_created_by_actor REFERENCES actors(id) ON DELETE RESTRICT,
  approved_by_actor_id UUID NOT NULL
    CONSTRAINT fk_nse_approved_by_actor REFERENCES actors(id) ON DELETE RESTRICT,
  approved_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- suporta a FK composta (event_id, city_id) das filhas (garante mesma cidade estruturalmente)
  CONSTRAINT uq_nse_id_city UNIQUE (id, city_id)
);

COMMENT ON TABLE neighborhood_succession_events IS
  'N2-C (DECISION-0171 §9): evento de LINHAGEM territorial (division/merger/reorganization/extinction) '
  '+ evidencia. GLOBAL (sem tenant_id/RLS). Append-only. NAO muda retrospectivamente FKs — sucessao e '
  'historico; cada consumidor (Social/Bank/futuro) decide o efeito por contrato proprio. rename/correcao '
  'NAO sao sucessao (preservam o mesmo neighborhood_id, via nome+alias). effective_at = quando a '
  'reorganizacao passa a fazer sentido (NAO e created_at). Cardinalidade governada por constraint trigger '
  'deferred; source/target N:N nas filhas.';
COMMENT ON COLUMN neighborhood_succession_events.city_id IS 'Escopo territorial obrigatorio do evento; sucessao cross-city e impossivel no MVP (FKs compostas).';
COMMENT ON COLUMN neighborhood_succession_events.effective_at IS 'Instante da vigencia da reorganizacao territorial. NAO e created_at.';

-- ── 2. SOURCES (predecessores) ───────────────────────────────────────────────────────────────
CREATE TABLE neighborhood_succession_sources (
  event_id UUID NOT NULL,
  city_id UUID NOT NULL,
  neighborhood_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, neighborhood_id),
  CONSTRAINT fk_nss_event FOREIGN KEY (event_id, city_id)
    REFERENCES neighborhood_succession_events(id, city_id) ON DELETE RESTRICT,
  CONSTRAINT fk_nss_neighborhood FOREIGN KEY (city_id, neighborhood_id)
    REFERENCES neighborhoods(city_id, neighborhood_id) ON DELETE RESTRICT
);

COMMENT ON TABLE neighborhood_succession_sources IS
  'N2-C: predecessores (N) de um evento de sucessao. city_id = integridade composta (mesma cidade do '
  'evento e do bairro), NAO segunda identidade. Sem id surrogate, sem updated_at, sem ordem/peso/percentual. Append-only.';

-- ── 3. TARGETS (sucessores) ──────────────────────────────────────────────────────────────────
CREATE TABLE neighborhood_succession_targets (
  event_id UUID NOT NULL,
  city_id UUID NOT NULL,
  neighborhood_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, neighborhood_id),
  CONSTRAINT fk_nst_event FOREIGN KEY (event_id, city_id)
    REFERENCES neighborhood_succession_events(id, city_id) ON DELETE RESTRICT,
  CONSTRAINT fk_nst_neighborhood FOREIGN KEY (city_id, neighborhood_id)
    REFERENCES neighborhoods(city_id, neighborhood_id) ON DELETE RESTRICT
);

COMMENT ON TABLE neighborhood_succession_targets IS
  'N2-C: sucessores (N) de um evento. extinction = evento com sources e ZERO targets. Mesma integridade '
  'composta same-city de sources. Sem id surrogate/updated_at/ordem/peso. Append-only.';

CREATE INDEX idx_nss_neighborhood ON neighborhood_succession_sources(city_id, neighborhood_id);
CREATE INDEX idx_nst_neighborhood ON neighborhood_succession_targets(city_id, neighborhood_id);

-- ── 4. CARDINALIDADE GOVERNADA (constraint trigger deferred) ─────────────────────────────────
CREATE OR REPLACE FUNCTION enforce_neighborhood_succession_cardinality()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_event UUID;
  v_type TEXT;
  v_src INT;
  v_tgt INT;
  v_self INT;
  v_row JSONB;
BEGIN
  -- Resolve o event_id sem referenciar estaticamente campos ausentes: em events o registro tem
  -- 'id' e NAO 'event_id'; em sources/targets tem 'event_id' e NAO 'id'. Um CASE com NEW.id/NEW.event_id
  -- falha ("record new has no field ...") porque o plpgsql resolve o campo do ramo nao-tomado. to_jsonb
  -- contorna: preferir event_id (filhas), senao id (evento).
  -- Tabelas qualificadas com schema: a funcao usa search_path pinado (pg_catalog, pg_temp) por
  -- seguranca, entao public.* e obrigatorio para encontrar as tabelas.
  v_row := to_jsonb(NEW);
  v_event := COALESCE((v_row->>'event_id')::uuid, (v_row->>'id')::uuid);
  SELECT succession_type INTO v_type FROM public.neighborhood_succession_events WHERE id = v_event;
  IF v_type IS NULL THEN
    RETURN NULL; -- evento removido? append-only impede; nada a validar
  END IF;
  SELECT count(*) INTO v_src FROM public.neighborhood_succession_sources WHERE event_id = v_event;
  SELECT count(*) INTO v_tgt FROM public.neighborhood_succession_targets WHERE event_id = v_event;
  SELECT count(*) INTO v_self FROM public.neighborhood_succession_sources s
    WHERE s.event_id = v_event
      AND EXISTS (SELECT 1 FROM public.neighborhood_succession_targets t
                  WHERE t.event_id = v_event AND t.neighborhood_id = s.neighborhood_id);

  IF v_src < 1 THEN
    RAISE EXCEPTION 'NEIGHBORHOOD_SUCCESSION_SOURCE_REQUIRED: todo evento de sucessao exige ao menos 1 predecessor.'
      USING ERRCODE = 'raise_exception';
  END IF;
  IF v_self > 0 THEN
    RAISE EXCEPTION 'NEIGHBORHOOD_SUCCESSION_SELF_REFERENCE_FORBIDDEN: um bairro nao pode ser source e target do mesmo evento.'
      USING ERRCODE = 'raise_exception';
  END IF;

  IF v_type = 'division' THEN
    IF NOT (v_src = 1 AND v_tgt >= 2) THEN
      RAISE EXCEPTION 'NEIGHBORHOOD_SUCCESSION_DIVISION_CARDINALITY_INVALID: division exige exatamente 1 source e >=2 targets (achado src=%, tgt=%).', v_src, v_tgt
        USING ERRCODE = 'raise_exception';
    END IF;
  ELSIF v_type = 'merger' THEN
    IF NOT (v_src >= 2 AND v_tgt = 1) THEN
      RAISE EXCEPTION 'NEIGHBORHOOD_SUCCESSION_MERGER_CARDINALITY_INVALID: merger exige >=2 sources e exatamente 1 target (achado src=%, tgt=%).', v_src, v_tgt
        USING ERRCODE = 'raise_exception';
    END IF;
  ELSIF v_type = 'reorganization' THEN
    IF NOT (v_src >= 1 AND v_tgt >= 1 AND (v_src > 1 OR v_tgt > 1)) THEN
      RAISE EXCEPTION 'NEIGHBORHOOD_SUCCESSION_REORGANIZATION_CARDINALITY_INVALID: reorganization exige >=1 de cada lado e >1 em ao menos um lado (1->1 proibido; mascara rename) (achado src=%, tgt=%).', v_src, v_tgt
        USING ERRCODE = 'raise_exception';
    END IF;
  ELSIF v_type = 'extinction' THEN
    IF NOT (v_src >= 1 AND v_tgt = 0) THEN
      RAISE EXCEPTION 'NEIGHBORHOOD_SUCCESSION_EXTINCTION_CARDINALITY_INVALID: extinction exige >=1 source e 0 targets (achado src=%, tgt=%).', v_src, v_tgt
        USING ERRCODE = 'raise_exception';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION enforce_neighborhood_succession_cardinality() IS
  'N2-C: valida cardinalidade do evento no FECHAMENTO da transacao (constraint trigger DEFERRABLE '
  'INITIALLY DEFERRED — um evento e montado em varios INSERTs). division 1->N, merger N->1, '
  'reorganization N->N com >1 de um lado (1->1 proibido), extinction N->0. Sem GUC/role/bypass; sem Bank/Social.';

CREATE CONSTRAINT TRIGGER trg_nse_cardinality
  AFTER INSERT ON neighborhood_succession_events
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION enforce_neighborhood_succession_cardinality();
CREATE CONSTRAINT TRIGGER trg_nss_cardinality
  AFTER INSERT ON neighborhood_succession_sources
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION enforce_neighborhood_succession_cardinality();
CREATE CONSTRAINT TRIGGER trg_nst_cardinality
  AFTER INSERT ON neighborhood_succession_targets
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION enforce_neighborhood_succession_cardinality();

-- ── 5. APPEND-ONLY PERMANENTE ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION enforce_neighborhood_succession_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF TG_TABLE_NAME = 'neighborhood_succession_events' THEN
    RAISE EXCEPTION 'NEIGHBORHOOD_SUCCESSION_EVENT_APPEND_ONLY: evento de sucessao e append-only (sem UPDATE/DELETE). Retificacao futura = decisao propria + nova trilha.'
      USING ERRCODE = 'raise_exception';
  ELSIF TG_TABLE_NAME = 'neighborhood_succession_sources' THEN
    RAISE EXCEPTION 'NEIGHBORHOOD_SUCCESSION_SOURCE_APPEND_ONLY: source de sucessao e append-only (sem UPDATE/DELETE).'
      USING ERRCODE = 'raise_exception';
  ELSE
    RAISE EXCEPTION 'NEIGHBORHOOD_SUCCESSION_TARGET_APPEND_ONLY: target de sucessao e append-only (sem UPDATE/DELETE).'
      USING ERRCODE = 'raise_exception';
  END IF;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION enforce_neighborhood_succession_append_only() IS
  'N2-C: append-only permanente das 3 tabelas de sucessao — UPDATE/DELETE bloqueados (molde bank_ledger/'
  'actor_delegation_events). Uma sucessao errada nao e editada/apagada silenciosamente. Sem bypass.';

CREATE TRIGGER trg_nse_append_only BEFORE UPDATE OR DELETE ON neighborhood_succession_events
  FOR EACH ROW EXECUTE FUNCTION enforce_neighborhood_succession_append_only();
CREATE TRIGGER trg_nss_append_only BEFORE UPDATE OR DELETE ON neighborhood_succession_sources
  FOR EACH ROW EXECUTE FUNCTION enforce_neighborhood_succession_append_only();
CREATE TRIGGER trg_nst_append_only BEFORE UPDATE OR DELETE ON neighborhood_succession_targets
  FOR EACH ROW EXECUTE FUNCTION enforce_neighborhood_succession_append_only();

-- ── 6. HOLD FÍSICO TEMPORÁRIO (até N2-E) ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION enforce_neighborhood_successions_writer_hold()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION
    'NEIGHBORHOOD_SUCCESSION_CANONICAL_WRITER_HOLD: sucessao territorial esta em HOLD fisico (N2-C). '
    'INSERT/UPDATE/DELETE proibidos ate o writer canonico (N2-E), que exige authority territorial (N2-D) '
    '+ alteracao consciente dos guards + nova auditoria.'
    USING ERRCODE = 'raise_exception';
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION enforce_neighborhood_successions_writer_hold() IS
  'N2-C: HOLD temporario e governado — as 3 tabelas de sucessao permanecem read-only ate o writer N2-E. '
  'Substituicao SO junto do writer, com authority (N2-D), guards conscientes e nova auditoria. Sem bypass.';

CREATE TRIGGER trg_nse_writer_hold BEFORE INSERT OR UPDATE OR DELETE ON neighborhood_succession_events
  FOR EACH STATEMENT EXECUTE FUNCTION enforce_neighborhood_successions_writer_hold();
CREATE TRIGGER trg_nss_writer_hold BEFORE INSERT OR UPDATE OR DELETE ON neighborhood_succession_sources
  FOR EACH STATEMENT EXECUTE FUNCTION enforce_neighborhood_successions_writer_hold();
CREATE TRIGGER trg_nst_writer_hold BEFORE INSERT OR UPDATE OR DELETE ON neighborhood_succession_targets
  FOR EACH STATEMENT EXECUTE FUNCTION enforce_neighborhood_successions_writer_hold();

ALTER TABLE neighborhood_succession_events  ENABLE ALWAYS TRIGGER trg_nse_writer_hold;
ALTER TABLE neighborhood_succession_sources ENABLE ALWAYS TRIGGER trg_nss_writer_hold;
ALTER TABLE neighborhood_succession_targets ENABLE ALWAYS TRIGGER trg_nst_writer_hold;

-- ── 7. ACL: SELECT-only para o runtime-alvo ──────────────────────────────────────────────────
REVOKE ALL ON TABLE public.neighborhood_succession_events, public.neighborhood_succession_sources,
  public.neighborhood_succession_targets FROM unificard_app;
REVOKE ALL ON TABLE public.neighborhood_succession_events, public.neighborhood_succession_sources,
  public.neighborhood_succession_targets FROM PUBLIC;
GRANT SELECT ON TABLE public.neighborhood_succession_events, public.neighborhood_succession_sources,
  public.neighborhood_succession_targets TO unificard_app;

-- ── 8. FAIL-CLOSED PÓS ───────────────────────────────────────────────────────────────────────
DO $$
DECLARE t TEXT; v "char";
BEGIN
  FOREACH t IN ARRAY ARRAY['neighborhood_succession_events','neighborhood_succession_sources','neighborhood_succession_targets'] LOOP
    IF to_regclass('public.'||t) IS NULL THEN
      RAISE EXCEPTION 'MIGRATION_ABORT: tabela % ausente', t;
    END IF;
    -- colunas proibidas
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name=t
               AND column_name IN ('tenant_id','status','is_active','metadata','payload','external_code','authority_grant_id','valid_until_at')) THEN
      RAISE EXCEPTION 'MIGRATION_ABORT: coluna proibida em %', t;
    END IF;
    -- RLS off
    IF (SELECT relrowsecurity FROM pg_class WHERE relname=t) THEN
      RAISE EXCEPTION 'MIGRATION_ABORT: RLS ligada em %', t;
    END IF;
    -- HOLD ALWAYS
    SELECT tgenabled INTO v FROM pg_trigger WHERE tgrelid=('public.'||t)::regclass AND tgname LIKE '%_writer_hold';
    IF v IS DISTINCT FROM 'A' THEN
      RAISE EXCEPTION 'MIGRATION_ABORT: HOLD de % nao esta ENABLE ALWAYS (tgenabled=%)', t, COALESCE(v::text,'ausente');
    END IF;
    -- append-only presente
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=('public.'||t)::regclass AND tgname LIKE '%_append_only') THEN
      RAISE EXCEPTION 'MIGRATION_ABORT: append-only de % ausente', t;
    END IF;
    -- ACL SELECT-only
    IF has_table_privilege('unificard_app','public.'||t,'INSERT')
       OR has_table_privilege('unificard_app','public.'||t,'UPDATE')
       OR has_table_privilege('unificard_app','public.'||t,'DELETE')
       OR has_table_privilege('unificard_app','public.'||t,'TRUNCATE')
       OR NOT has_table_privilege('unificard_app','public.'||t,'SELECT') THEN
      RAISE EXCEPTION 'MIGRATION_ABORT: ACL de % divergente (esperado SELECT-only)', t;
    END IF;
    IF (SELECT count(*) FROM information_schema.table_privileges WHERE table_name=t AND grantee='PUBLIC') <> 0 THEN
      RAISE EXCEPTION 'MIGRATION_ABORT: PUBLIC tem privilegio em %', t;
    END IF;
    IF (SELECT tableowner FROM pg_tables WHERE tablename=t) IS DISTINCT FROM 'postgres' THEN
      RAISE EXCEPTION 'MIGRATION_ABORT: owner de % divergente', t;
    END IF;
    IF (SELECT count(*) FROM information_schema.columns WHERE table_name=t) = 0 THEN
      RAISE EXCEPTION 'MIGRATION_ABORT: % sem colunas', t;
    END IF;
  END LOOP;
  -- constraint triggers deferred
  IF (SELECT count(*) FROM pg_trigger WHERE tgname IN ('trg_nse_cardinality','trg_nss_cardinality','trg_nst_cardinality') AND tgdeferrable AND tginitdeferred) <> 3 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: constraint triggers de cardinalidade nao estao DEFERRABLE INITIALLY DEFERRED';
  END IF;
  -- vocabulário exato
  IF (SELECT count(*) FROM pg_constraint WHERE conname='chk_nse_succession_type'
      AND pg_get_constraintdef(oid) LIKE '%division%' AND pg_get_constraintdef(oid) LIKE '%merger%'
      AND pg_get_constraintdef(oid) LIKE '%reorganization%' AND pg_get_constraintdef(oid) LIKE '%extinction%'
      AND pg_get_constraintdef(oid) NOT LIKE '%rename%' AND pg_get_constraintdef(oid) NOT LIKE '%correction%') <> 1 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: vocabulario de succession_type divergente';
  END IF;
  -- vazias; núcleo/aliases intactos
  IF (SELECT count(*) FROM neighborhood_succession_events) <> 0
     OR (SELECT count(*) FROM neighborhood_succession_sources) <> 0
     OR (SELECT count(*) FROM neighborhood_succession_targets) <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: tabelas de sucessao deveriam nascer VAZIAS';
  END IF;
  IF (SELECT count(*) FROM neighborhoods) <> 0 OR (SELECT count(*) FROM neighborhood_aliases) <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: nucleo/aliases deveriam continuar VAZIOS';
  END IF;
  SELECT tgenabled INTO v FROM pg_trigger WHERE tgrelid='public.neighborhoods'::regclass AND tgname='trg_neighborhoods_canonical_writer_hold';
  IF v IS DISTINCT FROM 'A' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: HOLD do nucleo alterado pela N2-C';
  END IF;
END $$;

COMMIT;
