-- 20260711110000_neighborhoods_core_foundation.sql
-- F-NEIGHBORHOOD-CANONICAL-IDENTITY · N2-A — EVOLUÇÃO ADITIVA DO NÚCLEO `neighborhoods`.
-- DECISION-0171 (identidade territorial canônica) + DECISION-0172 P4 (proveniência híbrida
-- governada) e P6 (vigência territorial separada de disponibilidade operacional).
--
-- O QUE ESTA MIGRATION FAZ (e SOMENTE isto):
--   1. adiciona proveniência governada (source_kind/source_reference/evidence);
--   2. adiciona autoria/aprovação mínima (created_by/approved_by_actor_id, approved_at);
--   3. adiciona vigência territorial (valid_from_at/valid_until_at);
--   4. cria trigger PERMANENTE de imutabilidade da identidade (id/city_id/creator/created_at
--      imutáveis; DELETE físico proibido);
--   5. verificações fail-closed antes e depois.
--
-- O QUE ELA NÃO FAZ: nenhum writer; nenhum INSERT/seed/backfill (catálogo está e permanece
-- VAZIO); nenhum alias/sucessão/candidato; nenhuma capability/grant; não toca o HOLD N2-pre
-- (trigger statement-level ENABLE ALWAYS segue soberano); não toca ACL; não toca addresses;
-- nada de Social/Bank (HOLDs 501 do nível neighborhood intactos).
--
-- SEM DEFAULTS (deliberado): nenhuma proveniência pode ser inventada; aprovação não pode ser
-- inferida; vigência não nasce de now() por conveniência — o writer canônico futuro (N2-E)
-- fornecerá tudo explicitamente.
--
-- Guard de regressão: backend/scripts/audit-neighborhood-core-foundation.mjs.

BEGIN;

-- ── 0. FAIL-CLOSED PRÉ-ALTER ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_hold "char";
BEGIN
  IF to_regclass('public.neighborhoods') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: neighborhoods nao existe';
  END IF;
  IF (SELECT count(*) FROM neighborhoods) <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: neighborhoods deveria estar VAZIA na N2-A (colunas NOT NULL sem default exigem catalogo vazio; backfill e proibido)';
  END IF;
  SELECT tgenabled INTO v_hold FROM pg_trigger
   WHERE tgrelid='public.neighborhoods'::regclass AND tgname='trg_neighborhoods_canonical_writer_hold';
  IF v_hold IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: HOLD N2-pre ausente — N2-A exige o HOLD fisico vivo';
  END IF;
  IF v_hold <> 'A' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: HOLD N2-pre nao esta ENABLE ALWAYS (tgenabled=%)', v_hold;
  END IF;
  IF has_table_privilege('unificard_app','public.neighborhoods','INSERT')
     OR has_table_privilege('unificard_app','public.neighborhoods','UPDATE')
     OR has_table_privilege('unificard_app','public.neighborhoods','DELETE') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: unificard_app recuperou DML em neighborhoods — REVOKE N2-pre violado';
  END IF;
  IF NOT has_table_privilege('unificard_app','public.neighborhoods','SELECT') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: SELECT de unificard_app perdido';
  END IF;
END $$;

-- ── 1. PROVENIÊNCIA GOVERNADA (DECISION-0172 P4) ─────────────────────────────────────────────
-- Vocabulário canônico DESTA fatia: CHECK fechado (não enum PG, não tabela de vocabulário).
-- Referência e evidência são obrigatórias para TODOS os source kinds — assim internal_curation
-- satisfaz a regra mais forte da P4 sem condicional frouxa.
ALTER TABLE neighborhoods
  ADD COLUMN source_kind TEXT NOT NULL
    CONSTRAINT chk_neighborhoods_source_kind
    CHECK (source_kind IN ('government_official', 'public_documentary', 'internal_curation')),
  ADD COLUMN source_reference TEXT NOT NULL
    CONSTRAINT chk_neighborhoods_source_reference_nonempty
    CHECK (btrim(source_reference) <> ''),
  ADD COLUMN evidence TEXT NOT NULL
    CONSTRAINT chk_neighborhoods_evidence_nonempty
    CHECK (btrim(evidence) <> ''),
  ADD COLUMN created_by_actor_id UUID NOT NULL
    CONSTRAINT fk_neighborhoods_created_by_actor
    REFERENCES actors(id) ON DELETE RESTRICT,
  ADD COLUMN approved_by_actor_id UUID NOT NULL
    CONSTRAINT fk_neighborhoods_approved_by_actor
    REFERENCES actors(id) ON DELETE RESTRICT,
  ADD COLUMN approved_at TIMESTAMPTZ NOT NULL,
  ADD COLUMN valid_from_at TIMESTAMPTZ NOT NULL,
  ADD COLUMN valid_until_at TIMESTAMPTZ NULL,
  ADD CONSTRAINT chk_neighborhoods_validity_interval
    CHECK (valid_until_at IS NULL OR valid_until_at > valid_from_at);

-- ── 2. SEMÂNTICA (comentários vinculantes) ──────────────────────────────────────────────────
COMMENT ON COLUMN neighborhoods.neighborhood_id IS
  'Identidade territorial CANONICA e ESTAVEL de bairro (DECISION-0171 §2). Nunca muda; rename preserva o id.';
COMMENT ON COLUMN neighborhoods.city_id IS
  'Contexto territorial OBRIGATORIO e IMUTAVEL da identidade (DECISION-0171 §2/§4). Erro de cadastro = desativar + criar correto, nunca mover.';
COMMENT ON COLUMN neighborhoods.name IS
  'Nome VIGENTE do bairro — exibicao, NAO identidade (DECISION-0171 §4). Rename futuro so via writer canonico, em transacao com alias.';
COMMENT ON COLUMN neighborhoods.source_kind IS
  'Classe GOVERNADA da fonte (DECISION-0172 P4): government_official | public_documentary | internal_curation. Vocabulario canonico = este CHECK.';
COMMENT ON COLUMN neighborhoods.source_reference IS
  'Referencia VERIFICAVEL da fonte (documento/cadastro/mapa). Procedencia, nunca identidade; nao substitui codigo oficial inexistente.';
COMMENT ON COLUMN neighborhoods.evidence IS
  'Fundamento documental/curatorial da entrada no catalogo. NAO e dado publico por padrao (superficie administrativa futura).';
COMMENT ON COLUMN neighborhoods.created_by_actor_id IS
  'Actor responsavel pela CRIACAO do registro (ACTOR_TRACEABILITY). Imutavel. NAO prova authority sozinho — os 5 elos completos pertencem ao N2-D/E.';
COMMENT ON COLUMN neighborhoods.approved_by_actor_id IS
  'Actor que APROVOU a entrada no catalogo (DECISION-0172 P2: aprovar e operacao explicita, capability propria no N2-D). NAO prova authority sozinho.';
COMMENT ON COLUMN neighborhoods.approved_at IS
  'Momento da aprovacao canonica. Sem default: aprovacao nao pode ser inferida.';
COMMENT ON COLUMN neighborhoods.valid_from_at IS
  'Inicio da VIGENCIA TERRITORIAL (DECISION-0172 P6). Sem default: vigencia nao nasce de now() por conveniencia.';
COMMENT ON COLUMN neighborhoods.valid_until_at IS
  'Fim da vigencia territorial (NULL = vigente). Extincao encerra valid_until_at E is_active=false (P6).';
COMMENT ON COLUMN neighborhoods.is_active IS
  'DISPONIBILIDADE OPERACIONAL para listagem/uso (DECISION-0172 P6) — NAO e aprovacao (ver approved_*) nem vigencia (ver valid_*). Ocultacao tecnica temporaria pode usar is_active=false sem fingir extincao.';
COMMENT ON TABLE neighborhoods IS
  'Catalogo territorial CANONICO de bairros (Location Core, DECISION-0171/0172). GLOBAL: sem tenant_id e sem RLS (mesmo padrao countries/states/cities — dado de referencia, nao dado de tenant). Escrita: HOLD fisico N2-pre ate o writer canonico N2-E. Identidade imutavel: ver trg_neighborhood_identity_immutability.';

-- ── 3. IMUTABILIDADE PERMANENTE DA IDENTIDADE ────────────────────────────────────────────────
-- Separada do HOLD N2-pre (que e TEMPORARIO e statement-level). Esta e PERMANENTE e row-level:
-- mesmo quando o writer canonico existir (N2-E) e o HOLD cair, identidade/contexto/autoria de
-- criacao continuam imutaveis e DELETE fisico continua proibido (extincao = desativacao +
-- sucessao, DECISION-0172 §2).
CREATE OR REPLACE FUNCTION enforce_neighborhood_identity_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'NEIGHBORHOOD_IDENTITY_DELETE_FORBIDDEN: bairro canonico nunca e deletado fisicamente '
      '(DECISION-0172 §2) — extincao = desativacao + evento de sucessao (N2-C).'
      USING ERRCODE = 'raise_exception';
  END IF;
  IF NEW.neighborhood_id IS DISTINCT FROM OLD.neighborhood_id THEN
    RAISE EXCEPTION
      'NEIGHBORHOOD_IDENTITY_ID_IMMUTABLE: neighborhood_id e identidade canonica estavel (DECISION-0171 §2).'
      USING ERRCODE = 'raise_exception';
  END IF;
  IF NEW.city_id IS DISTINCT FROM OLD.city_id THEN
    RAISE EXCEPTION
      'NEIGHBORHOOD_IDENTITY_CITY_IMMUTABLE: city_id e contexto estrutural imutavel da identidade '
      '(DECISION-0172 §2) — erro de cadastro = desativar + criar correto.'
      USING ERRCODE = 'raise_exception';
  END IF;
  IF NEW.created_by_actor_id IS DISTINCT FROM OLD.created_by_actor_id THEN
    RAISE EXCEPTION
      'NEIGHBORHOOD_IDENTITY_CREATOR_IMMUTABLE: autoria de criacao nao e reescrita (ACTOR_TRACEABILITY).'
      USING ERRCODE = 'raise_exception';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION
      'NEIGHBORHOOD_IDENTITY_CREATED_AT_IMMUTABLE: momento de criacao nao e reescrito.'
      USING ERRCODE = 'raise_exception';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION enforce_neighborhood_identity_immutability() IS
  'N2-A (DECISION-0171/0172): imutabilidade PERMANENTE da identidade territorial — DELETE proibido; '
  'neighborhood_id/city_id/created_by_actor_id/created_at imutaveis. Independente e mais duradoura '
  'que o HOLD N2-pre (temporario): sobrevive a abertura do writer canonico N2-E. Sem GUC/role/bypass. '
  'Campos mutaveis (name/source/evidence/approved_*/is_active/valid_*) mudarao SO pelo writer auditado.';

DROP TRIGGER IF EXISTS trg_neighborhood_identity_immutability ON neighborhoods;
CREATE TRIGGER trg_neighborhood_identity_immutability
  BEFORE UPDATE OR DELETE ON neighborhoods
  FOR EACH ROW
  EXECUTE FUNCTION enforce_neighborhood_identity_immutability();

-- ── 4. FAIL-CLOSED PÓS-ALTER ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_hold "char";
  v_bad int;
BEGIN
  -- 8 colunas com shape exato (tipo + nullability + ZERO defaults)
  SELECT count(*) INTO v_bad FROM (
    VALUES ('source_kind','text','NO'), ('source_reference','text','NO'), ('evidence','text','NO'),
           ('created_by_actor_id','uuid','NO'), ('approved_by_actor_id','uuid','NO'),
           ('approved_at','timestamp with time zone','NO'),
           ('valid_from_at','timestamp with time zone','NO'),
           ('valid_until_at','timestamp with time zone','YES')
  ) AS expected(col, typ, nul)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_name='neighborhoods' AND c.column_name=expected.col
      AND c.data_type=expected.typ AND c.is_nullable=expected.nul AND c.column_default IS NULL
  );
  IF v_bad <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: % coluna(s) da N2-A ausentes ou com tipo/nullability/default divergente', v_bad;
  END IF;
  -- constraints/FKs presentes
  IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.neighborhoods'::regclass
      AND conname IN ('chk_neighborhoods_source_kind','chk_neighborhoods_source_reference_nonempty',
                      'chk_neighborhoods_evidence_nonempty','chk_neighborhoods_validity_interval',
                      'fk_neighborhoods_created_by_actor','fk_neighborhoods_approved_by_actor')) <> 6 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: constraints da N2-A incompletas';
  END IF;
  -- trigger de imutabilidade presente
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.neighborhoods'::regclass
                 AND tgname='trg_neighborhood_identity_immutability') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: trigger de imutabilidade ausente';
  END IF;
  -- HOLD N2-pre intacto e ALWAYS
  SELECT tgenabled INTO v_hold FROM pg_trigger
   WHERE tgrelid='public.neighborhoods'::regclass AND tgname='trg_neighborhoods_canonical_writer_hold';
  IF v_hold IS DISTINCT FROM 'A' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: HOLD N2-pre alterado (tgenabled=%)', COALESCE(v_hold::text,'ausente');
  END IF;
  -- ACL inalterada
  IF has_table_privilege('unificard_app','public.neighborhoods','INSERT')
     OR has_table_privilege('unificard_app','public.neighborhoods','UPDATE')
     OR has_table_privilege('unificard_app','public.neighborhoods','DELETE')
     OR NOT has_table_privilege('unificard_app','public.neighborhoods','SELECT') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: ACL de unificard_app mudou durante a N2-A';
  END IF;
  -- RLS continua desligada (catalogo global)
  IF (SELECT relrowsecurity FROM pg_class WHERE relname='neighborhoods') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: RLS foi ligada em neighborhoods (catalogo global nao tem RLS)';
  END IF;
  -- colunas proibidas nao surgiram
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='neighborhoods'
             AND column_name IN ('tenant_id','external_code','status','approval_status','review_status','metadata')) THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: coluna proibida na N2-A surgiu em neighborhoods';
  END IF;
  -- catalogo continua vazio
  IF (SELECT count(*) FROM neighborhoods) <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: neighborhoods deveria continuar VAZIA apos a N2-A';
  END IF;
END $$;

COMMIT;
