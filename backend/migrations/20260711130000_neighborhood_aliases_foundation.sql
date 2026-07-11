-- 20260711130000_neighborhood_aliases_foundation.sql
-- F-NEIGHBORHOOD-CANONICAL-IDENTITY · N2-B — FUNDAÇÃO CANÔNICA DE ALIASES DE BAIRRO.
-- DECISION-0171 §8 (aliases em estrutura filha; colisão = AMBIGUIDADE, nunca escolha silenciosa)
-- + DECISION-0172 §2 (aliases tabela-filha; alias nunca auto-resolve FK) e P4/P6 (proveniência/vigência).
--
-- O QUE ESTA MIGRATION FAZ (e SOMENTE isto):
--   1. cria a tabela filha GLOBAL `neighborhood_aliases` (shape canônico, zero defaults nos campos
--      de proveniência/aprovação/vigência);
--   2. unicidade PISO: UNIQUE(neighborhood_id, alias_normalized) — a MESMA forma normalizada pode
--      apontar para bairros DIFERENTES (inclusive na mesma cidade) = ambiguidade legítima;
--   3. imutabilidade permanente do alias (DELETE/id/pai/texto/creator/created_at);
--   4. HOLD físico temporário (sem writer até N2-E) + ACL SELECT-only;
--   5. verificações fail-closed pré e pós.
--
-- O QUE ELA NÃO FAZ: nenhum resolver/ranking/preferred/primary/score; nenhum writer/rename/seed;
-- nenhuma sucessão/candidato; não toca o núcleo (HOLD/ACL/shape de neighborhoods intocados);
-- nada de addresses/Social/Bank.
--
-- SEMÂNTICA VINCULANTE: alias NÃO cria bairro; alias NÃO substitui neighborhood_id; colisão NÃO
-- escolhe vencedor — o resolver futuro retorna N candidatos e decisão humana/governada resolve;
-- alias NUNCA preenche FK automaticamente; texto de provider/CEP/display NUNCA vira identidade.
--
-- RENAME (contrato futuro, N2-E — NÃO implementado aqui): operação transacional do writer —
-- (1) validar authority; (2) preservar neighborhood_id; (3) inserir o nome anterior como alias;
-- (4) atualizar neighborhoods.name; (5) atualizar proveniência/aprovação; (6) persistir os 5 elos.
-- Rename usa internal_curation + referência/evidência governadas (salvo decisão futura de
-- vocabulário próprio). Rename ≠ sucessão. Correção de texto de alias: NÃO edita a linha —
-- encerra/desativa o alias incorreto e cria novo registro governado.
--
-- Guards: audit-neighborhood-alias-foundation.mjs (novo) + audit-neighborhood-core-foundation.mjs
-- (ajuste consciente: reconhece esta migration como a casa canônica de aliases).

BEGIN;

-- ── 0. FAIL-CLOSED PRÉ ───────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_hold "char";
  v_immut "char";
BEGIN
  IF to_regclass('public.neighborhoods') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: neighborhoods nao existe';
  END IF;
  IF (SELECT count(*) FROM neighborhoods) <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: neighborhoods deveria estar VAZIA na N2-B';
  END IF;
  IF to_regclass('public.neighborhood_aliases') IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: neighborhood_aliases ja existe — nao criar estrutura concorrente';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename ~ 'neighborhood.*(alias|synonym)') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: tabela territorial de alias/synonym concorrente detectada';
  END IF;
  IF (SELECT count(*) FROM pg_proc WHERE proname='normalize_name') = 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: normalize_name ausente';
  END IF;
  -- núcleo N2-A/A.1 íntegro
  IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.neighborhoods'::regclass
      AND conname IN ('chk_neighborhoods_source_kind','chk_neighborhoods_source_reference_nonempty',
                      'chk_neighborhoods_evidence_nonempty','chk_neighborhoods_validity_interval',
                      'fk_neighborhoods_created_by_actor','fk_neighborhoods_approved_by_actor')) <> 6 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: shape N2-A/A.1 do nucleo divergente';
  END IF;
  SELECT tgenabled INTO v_hold FROM pg_trigger
   WHERE tgrelid='public.neighborhoods'::regclass AND tgname='trg_neighborhoods_canonical_writer_hold';
  IF v_hold IS DISTINCT FROM 'A' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: HOLD do nucleo nao esta ENABLE ALWAYS (tgenabled=%)', COALESCE(v_hold::text,'ausente');
  END IF;
  SELECT tgenabled INTO v_immut FROM pg_trigger
   WHERE tgrelid='public.neighborhoods'::regclass AND tgname='trg_neighborhood_identity_immutability';
  IF v_immut IS NULL OR v_immut NOT IN ('O','A') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: imutabilidade do nucleo ausente/rebaixada (tgenabled=%)', COALESCE(v_immut::text,'ausente');
  END IF;
  IF has_table_privilege('unificard_app','public.neighborhoods','INSERT')
     OR NOT has_table_privilege('unificard_app','public.neighborhoods','SELECT') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: ACL do nucleo divergente';
  END IF;
  IF (SELECT relrowsecurity FROM pg_class WHERE relname='neighborhoods') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: RLS do nucleo ligada';
  END IF;
END $$;

-- ── 1. TABELA FILHA GLOBAL ───────────────────────────────────────────────────────────────────
CREATE TABLE neighborhood_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id UUID NOT NULL
    CONSTRAINT fk_neighborhood_aliases_neighborhood
    REFERENCES neighborhoods(neighborhood_id) ON DELETE RESTRICT,
  alias TEXT NOT NULL
    CONSTRAINT chk_neighborhood_aliases_alias_nonempty
    CHECK (alias ~ '[^[:space:]]'),
  alias_normalized TEXT GENERATED ALWAYS AS (normalize_name(alias)) STORED,
  source_kind TEXT NOT NULL
    CONSTRAINT chk_neighborhood_aliases_source_kind
    CHECK (source_kind IN ('government_official', 'public_documentary', 'internal_curation')),
  source_reference TEXT NOT NULL
    CONSTRAINT chk_neighborhood_aliases_source_reference_nonempty
    CHECK (source_reference ~ '[^[:space:]]'),
  evidence TEXT NOT NULL
    CONSTRAINT chk_neighborhood_aliases_evidence_nonempty
    CHECK (evidence ~ '[^[:space:]]'),
  created_by_actor_id UUID NOT NULL
    CONSTRAINT fk_neighborhood_aliases_created_by_actor
    REFERENCES actors(id) ON DELETE RESTRICT,
  approved_by_actor_id UUID NOT NULL
    CONSTRAINT fk_neighborhood_aliases_approved_by_actor
    REFERENCES actors(id) ON DELETE RESTRICT,
  approved_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL,
  valid_from_at TIMESTAMPTZ NOT NULL,
  valid_until_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_neighborhood_aliases_validity_interval
    CHECK (valid_until_at IS NULL OR valid_until_at > valid_from_at),
  -- UNICIDADE PISO: dedup dentro do MESMO bairro. NÃO existe UNIQUE global nem por cidade —
  -- a mesma forma normalizada em bairros diferentes é AMBIGUIDADE LEGÍTIMA preservada.
  CONSTRAINT uq_neighborhood_aliases_parent_normalized
    UNIQUE (neighborhood_id, alias_normalized)
);

-- Índices: substrato de BUSCA DE CANDIDATOS, nunca autorização de resolução automática.
CREATE INDEX idx_neighborhood_aliases_neighborhood ON neighborhood_aliases(neighborhood_id);
CREATE INDEX idx_neighborhood_aliases_normalized ON neighborhood_aliases(alias_normalized);

-- updated_at: reusa a função canônica existente (não criar segunda implementação).
CREATE TRIGGER trg_neighborhood_aliases_updated_at
  BEFORE UPDATE ON neighborhood_aliases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE neighborhood_aliases IS
  'Aliases de bairro (Location Core, DECISION-0171 §8 / DECISION-0172 §2). Tabela GLOBAL subordinada '
  '(sem tenant_id/RLS, padrao do Location Core). Alias e rotulo historico/alternativo — '
  'neighborhoods.neighborhood_id continua sendo a UNICA identidade territorial. Alias NAO cria '
  'bairro, NAO substitui neighborhood_id, NUNCA preenche FK automaticamente; colisao entre bairros '
  'NAO escolhe vencedor (resolver futuro retorna N candidatos; decisao humana/governada resolve). '
  'Texto de provider/CEP/display nunca vira identidade. Sem city_id redundante: cidade deriva de '
  'neighborhood_id -> neighborhoods.city_id. Escrita: HOLD fisico ate o writer canonico N2-E.';
COMMENT ON COLUMN neighborhood_aliases.id IS
  'Identidade TECNICA do registro de alias — NAO e identidade territorial (essa e neighborhoods.neighborhood_id).';
COMMENT ON COLUMN neighborhood_aliases.alias IS
  'Texto do alias. IMUTAVEL: correcao de texto = encerrar/desativar este registro + criar novo governado.';
COMMENT ON COLUMN neighborhood_aliases.alias_normalized IS
  'GENERATED via normalize_name() (mesma normalizacao do catalogo — sem normalizacao local paralela). Imutavel por derivacao.';
COMMENT ON COLUMN neighborhood_aliases.source_kind IS
  'Vocabulario GOVERNADO reutilizado do nucleo (DECISION-0172 P4): government_official | public_documentary | internal_curation. Sem taxonomia paralela.';
COMMENT ON COLUMN neighborhood_aliases.created_by_actor_id IS
  'Autoria da criacao (ACTOR_TRACEABILITY) — NAO prova authority sozinho (5 elos = N2-D/E).';
COMMENT ON COLUMN neighborhood_aliases.approved_by_actor_id IS
  'Aprovacao explicita (DECISION-0172 P2) — NAO prova authority sozinho.';
COMMENT ON COLUMN neighborhood_aliases.is_active IS
  'Disponibilidade OPERACIONAL do alias — nao representa aprovacao (approved_*) nem vigencia (valid_*). Sem DEFAULT: o writer futuro decide explicitamente.';

-- ── 2. IMUTABILIDADE PERMANENTE DO ALIAS ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION enforce_neighborhood_alias_identity_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'NEIGHBORHOOD_ALIAS_DELETE_FORBIDDEN: alias nunca e deletado fisicamente — encerre a vigencia '
      '(valid_until_at) e/ou desative (is_active=false) pelo writer governado (N2-E).'
      USING ERRCODE = 'raise_exception';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'NEIGHBORHOOD_ALIAS_ID_IMMUTABLE: id tecnico do alias nao muda.'
      USING ERRCODE = 'raise_exception';
  END IF;
  IF NEW.neighborhood_id IS DISTINCT FROM OLD.neighborhood_id THEN
    RAISE EXCEPTION
      'NEIGHBORHOOD_ALIAS_PARENT_IMMUTABLE: alias nao muda de bairro — encerre este e crie novo no bairro correto.'
      USING ERRCODE = 'raise_exception';
  END IF;
  IF NEW.alias IS DISTINCT FROM OLD.alias THEN
    RAISE EXCEPTION
      'NEIGHBORHOOD_ALIAS_TEXT_IMMUTABLE: texto do alias nao e editado — encerre/desative o incorreto e crie novo registro governado.'
      USING ERRCODE = 'raise_exception';
  END IF;
  IF NEW.created_by_actor_id IS DISTINCT FROM OLD.created_by_actor_id THEN
    RAISE EXCEPTION 'NEIGHBORHOOD_ALIAS_CREATOR_IMMUTABLE: autoria de criacao nao e reescrita (ACTOR_TRACEABILITY).'
      USING ERRCODE = 'raise_exception';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'NEIGHBORHOOD_ALIAS_CREATED_AT_IMMUTABLE: momento de criacao nao e reescrito.'
      USING ERRCODE = 'raise_exception';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION enforce_neighborhood_alias_identity_immutability() IS
  'N2-B (DECISION-0171 §8): imutabilidade PERMANENTE do alias — DELETE proibido; id/neighborhood_id/'
  'alias/created_by_actor_id/created_at imutaveis (alias_normalized e GENERATED do alias, logo '
  'materialmente imutavel). Campos mutaveis (source_*/evidence/approved_*/is_active/valid_*) mudarao '
  'SO pelo writer governado (N2-E). Trigger ordinario (tgenabled=O), mesmo racional da N2-A.1: '
  'unificard_app NOSUPERUSER; ENABLE ALWAYS nao impediria DDL deliberado; guard + introspecao completam. '
  'Sem GUC/role/bypass.';

CREATE TRIGGER trg_neighborhood_alias_identity_immutability
  BEFORE UPDATE OR DELETE ON neighborhood_aliases
  FOR EACH ROW
  EXECUTE FUNCTION enforce_neighborhood_alias_identity_immutability();

-- ── 3. HOLD FÍSICO TEMPORÁRIO (sem writer até N2-E) ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION enforce_neighborhood_aliases_writer_hold()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION
    'NEIGHBORHOOD_ALIAS_CANONICAL_WRITER_HOLD: aliases de bairro estao em HOLD fisico (N2-B). '
    'INSERT/UPDATE/DELETE proibidos ate o writer canonico (N2-E), que exige authority territorial '
    '(N2-D) + alteracao consciente dos guards + nova auditoria. Alias nunca nasce de texto '
    'livre/provider (DECISION-0079 §6 / DECISION-0171 §8).'
    USING ERRCODE = 'raise_exception';
  RETURN NULL; -- inalcancavel; presente por forma
END;
$$;

COMMENT ON FUNCTION enforce_neighborhood_aliases_writer_hold() IS
  'N2-B: HOLD temporario e governado — neighborhood_aliases permanece read-only ate o writer canonico '
  'N2-E. Substituicao SOMENTE junto do writer, com authority (N2-D), guards conscientes e nova auditoria. '
  'Sem bypass por GUC/role/tenant/superuser como regra de produto.';

CREATE TRIGGER trg_neighborhood_aliases_writer_hold
  BEFORE INSERT OR UPDATE OR DELETE ON neighborhood_aliases
  FOR EACH STATEMENT
  EXECUTE FUNCTION enforce_neighborhood_aliases_writer_hold();

ALTER TABLE neighborhood_aliases ENABLE ALWAYS TRIGGER trg_neighborhood_aliases_writer_hold;

-- ── 4. ACL: SELECT-only para o runtime-alvo ──────────────────────────────────────────────────
-- Default privileges (20260620120000) concedem DML a toda tabela nova — revogar explicitamente.
GRANT SELECT ON TABLE public.neighborhood_aliases TO unificard_app;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.neighborhood_aliases FROM unificard_app;

-- ── 5. FAIL-CLOSED PÓS ───────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_hold "char";
  v_immut "char";
  v_gen text;
  v_bad int;
BEGIN
  -- shape: colunas com tipo/nullability/default esperados
  SELECT count(*) INTO v_bad FROM (
    VALUES ('neighborhood_id','uuid','NO', false), ('alias','text','NO', false),
           ('source_kind','text','NO', false), ('source_reference','text','NO', false),
           ('evidence','text','NO', false), ('created_by_actor_id','uuid','NO', false),
           ('approved_by_actor_id','uuid','NO', false),
           ('approved_at','timestamp with time zone','NO', false),
           ('is_active','boolean','NO', false),
           ('valid_from_at','timestamp with time zone','NO', false),
           ('valid_until_at','timestamp with time zone','YES', false)
  ) AS expected(col, typ, nul, has_default)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_name='neighborhood_aliases' AND c.column_name=expected.col
      AND c.data_type=expected.typ AND c.is_nullable=expected.nul
      AND ((c.column_default IS NULL) = NOT expected.has_default)
  );
  IF v_bad <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: % coluna(s) com shape divergente em neighborhood_aliases', v_bad;
  END IF;
  -- colunas proibidas
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='neighborhood_aliases'
             AND column_name IN ('city_id','tenant_id','status','external_code','metadata','owner_actor_id','account_id','capability_id')) THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: coluna proibida em neighborhood_aliases';
  END IF;
  -- GENERATED usa normalize_name
  SELECT generation_expression INTO v_gen FROM information_schema.columns
   WHERE table_name='neighborhood_aliases' AND column_name='alias_normalized';
  IF v_gen IS NULL OR v_gen NOT ILIKE '%normalize_name%' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: alias_normalized nao e GENERATED via normalize_name (achado: %)', COALESCE(v_gen,'ausente');
  END IF;
  -- constraints/uniqueness
  IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.neighborhood_aliases'::regclass
      AND conname IN ('fk_neighborhood_aliases_neighborhood','chk_neighborhood_aliases_alias_nonempty',
                      'chk_neighborhood_aliases_source_kind','chk_neighborhood_aliases_source_reference_nonempty',
                      'chk_neighborhood_aliases_evidence_nonempty','fk_neighborhood_aliases_created_by_actor',
                      'fk_neighborhood_aliases_approved_by_actor','chk_neighborhood_aliases_validity_interval',
                      'uq_neighborhood_aliases_parent_normalized')) <> 9 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: constraints da N2-B incompletas';
  END IF;
  -- NENHUMA unique global/por cidade sobre alias_normalized (só o piso composto)
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename='neighborhood_aliases'
      AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%alias_normalized%'
      AND indexdef NOT ILIKE '%neighborhood_id%'
  ) THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: UNIQUE global sobre alias_normalized mataria a ambiguidade legitima';
  END IF;
  -- triggers
  SELECT tgenabled INTO v_immut FROM pg_trigger
   WHERE tgrelid='public.neighborhood_aliases'::regclass AND tgname='trg_neighborhood_alias_identity_immutability';
  IF v_immut IS NULL OR v_immut NOT IN ('O','A') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: imutabilidade do alias ausente/rebaixada (tgenabled=%)', COALESCE(v_immut::text,'ausente');
  END IF;
  SELECT tgenabled INTO v_hold FROM pg_trigger
   WHERE tgrelid='public.neighborhood_aliases'::regclass AND tgname='trg_neighborhood_aliases_writer_hold';
  IF v_hold IS DISTINCT FROM 'A' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: HOLD de aliases nao esta ENABLE ALWAYS (tgenabled=%)', COALESCE(v_hold::text,'ausente');
  END IF;
  -- ACL
  IF has_table_privilege('unificard_app','public.neighborhood_aliases','INSERT')
     OR has_table_privilege('unificard_app','public.neighborhood_aliases','UPDATE')
     OR has_table_privilege('unificard_app','public.neighborhood_aliases','DELETE')
     OR NOT has_table_privilege('unificard_app','public.neighborhood_aliases','SELECT') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: ACL de neighborhood_aliases divergente (esperado SELECT-only)';
  END IF;
  -- RLS off (catalogo global)
  IF (SELECT relrowsecurity FROM pg_class WHERE relname='neighborhood_aliases') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: RLS ligada em neighborhood_aliases';
  END IF;
  -- vazias; nucleo intocado
  IF (SELECT count(*) FROM neighborhood_aliases) <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: neighborhood_aliases deveria nascer VAZIA';
  END IF;
  IF (SELECT count(*) FROM neighborhoods) <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: neighborhoods deveria continuar VAZIA';
  END IF;
  SELECT tgenabled INTO v_hold FROM pg_trigger
   WHERE tgrelid='public.neighborhoods'::regclass AND tgname='trg_neighborhoods_canonical_writer_hold';
  IF v_hold IS DISTINCT FROM 'A' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: HOLD do nucleo foi alterado pela N2-B';
  END IF;
  IF has_table_privilege('unificard_app','public.neighborhoods','INSERT') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: ACL do nucleo foi alterada pela N2-B';
  END IF;
END $$;

COMMIT;
