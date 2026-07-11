-- 20260711140000_neighborhood_aliases_hardening.sql
-- F-NEIGHBORHOOD-CANONICAL-IDENTITY · N2-B.1 — SANEAMENTO das ressalvas Yala da N2-B.
-- Forward-only: a migration aplicada 20260711130000 NAO e editada.
--
-- R1 (Yala): normalize_name() = LOWER(unaccent(...)) NAO remove whitespace de borda.
--     " Centro " e "Centro" geram alias_normalized DIFERENTES, escapando de
--     UNIQUE(neighborhood_id, alias_normalized) — provado ao vivo:
--     normalize_name(' Centro ') <> normalize_name('Centro').
--     FIX: NAO alterar normalize_name() (helper unico compartilhado por todo o Location Core —
--     alterar mudaria countries/states/cities/neighborhoods simultaneamente, fora do escopo desta
--     fatia). A correcao fica como INVARIANTE DA COLUNA alias: novo CHECK que proibe whitespace
--     na primeira OU ultima posicao. Coexiste com o CHECK existente
--     chk_neighborhood_aliases_alias_nonempty (alias ~ '[^[:space:]]', exige ao menos um
--     caractere real) — perguntas DIFERENTES: nonempty vs. sem-borda.
--
-- R2 (Yala): o guard nao detectava concessao futura de TRUNCATE nem troca de ownership da
--     tabela de aliases. FIX no guard (nao nesta migration): audit-neighborhood-alias-foundation
--     passa a morder GRANT TRUNCATE / GRANT ALL / ALTER ... OWNER TO em migrations posteriores.
--
-- Observacao registrada, NAO corrigida aqui (fora do escopo desta microfatia, decisao propria
-- futura antes do N2-E): neighborhoods.name_normalized tem o MESMO comportamento
-- (normalize_name nao faz trim) — confirmado por teste em transacao abortada durante o
-- read-first, sem alterar neighborhoods.
--
-- Semantica vinculante: esta fatia corrige SOMENTE whitespace de BORDA. NAO afirma cobertura de
-- todo whitespace Unicode; NAO afirma que normalize_name faz trim; NAO colapsa espacos internos.

BEGIN;

-- ── 0. FAIL-CLOSED PRÉ ───────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_hold_a "char";
  v_hold_n "char";
  v_immut_a "char";
  v_owner text;
BEGIN
  IF to_regclass('public.neighborhood_aliases') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: neighborhood_aliases nao existe';
  END IF;
  IF (SELECT count(*) FROM neighborhood_aliases) <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: neighborhood_aliases deveria estar VAZIA';
  END IF;
  IF (SELECT count(*) FROM neighborhoods) <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: neighborhoods deveria estar VAZIA';
  END IF;
  IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.neighborhood_aliases'::regclass
      AND conname='chk_neighborhood_aliases_alias_nonempty') <> 1 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: CHECK nonempty original ausente';
  END IF;
  IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.neighborhood_aliases'::regclass
      AND conname='uq_neighborhood_aliases_parent_normalized') <> 1 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: UNIQUE piso ausente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='neighborhood_aliases' AND column_name='alias_normalized'
                   AND generation_expression ILIKE '%normalize_name%') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: alias_normalized nao e GENERATED via normalize_name';
  END IF;
  SELECT tgenabled INTO v_hold_a FROM pg_trigger
   WHERE tgrelid='public.neighborhood_aliases'::regclass AND tgname='trg_neighborhood_aliases_writer_hold';
  IF v_hold_a IS DISTINCT FROM 'A' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: HOLD de aliases nao esta ENABLE ALWAYS (tgenabled=%)', COALESCE(v_hold_a::text,'ausente');
  END IF;
  SELECT tgenabled INTO v_immut_a FROM pg_trigger
   WHERE tgrelid='public.neighborhood_aliases'::regclass AND tgname='trg_neighborhood_alias_identity_immutability';
  IF v_immut_a IS NULL OR v_immut_a NOT IN ('O','A') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: imutabilidade de aliases ausente/rebaixada (tgenabled=%)', COALESCE(v_immut_a::text,'ausente');
  END IF;
  IF has_table_privilege('unificard_app','public.neighborhood_aliases','INSERT')
     OR has_table_privilege('unificard_app','public.neighborhood_aliases','TRUNCATE')
     OR NOT has_table_privilege('unificard_app','public.neighborhood_aliases','SELECT') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: ACL de aliases divergente (esperado SELECT-only, sem TRUNCATE)';
  END IF;
  SELECT tableowner INTO v_owner FROM pg_tables WHERE tablename='neighborhood_aliases';
  IF v_owner IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: owner de neighborhood_aliases divergente do esperado (owner=%)', v_owner;
  END IF;
  IF (SELECT relrowsecurity FROM pg_class WHERE relname='neighborhood_aliases') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: RLS ligada em neighborhood_aliases';
  END IF;
  -- núcleo (tabela pai) intocado
  SELECT tgenabled INTO v_hold_n FROM pg_trigger
   WHERE tgrelid='public.neighborhoods'::regclass AND tgname='trg_neighborhoods_canonical_writer_hold';
  IF v_hold_n IS DISTINCT FROM 'A' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: HOLD do nucleo divergente (tgenabled=%)', COALESCE(v_hold_n::text,'ausente');
  END IF;
END $$;

-- ── 1. R1: CHECK de borda (não substitui GENERATED, não toca normalize_name) ─────────────────
ALTER TABLE neighborhood_aliases
  ADD CONSTRAINT chk_neighborhood_aliases_alias_no_edge_whitespace
    CHECK (alias !~ '^[[:space:]]' AND alias !~ '[[:space:]]$');

COMMENT ON CONSTRAINT chk_neighborhood_aliases_alias_no_edge_whitespace ON neighborhood_aliases IS
  'N2-B.1 (ressalva Yala R1): proibe whitespace na primeira OU ultima posicao de alias. '
  'normalize_name() = LOWER(unaccent(...)) NAO faz trim (helper unico compartilhado por todo o '
  'Location Core — nao alterado aqui); sem este CHECK, " Centro " e "Centro" geravam '
  'alias_normalized distintos e escapavam de UNIQUE(neighborhood_id, alias_normalized). '
  'Coexiste com chk_neighborhood_aliases_alias_nonempty (exige >=1 caractere real — pergunta '
  'DIFERENTE). Cobre whitespace ASCII classico (space/tab/newline/CR/FF/VT) no locale vivo do '
  'banco; NAO promete cobertura de todo whitespace Unicode; NAO colapsa espacos internos.';

-- ── 2. FAIL-CLOSED PÓS ───────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_def text;
  v_hold_a "char";
  v_immut_a "char";
  v_owner text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid='public.neighborhood_aliases'::regclass
     AND conname='chk_neighborhood_aliases_alias_no_edge_whitespace';
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: CHECK de borda nao foi criado';
  END IF;
  IF v_def NOT LIKE '%^[[:space:]]%' OR v_def NOT LIKE '%[[:space:]]$%' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: CHECK de borda sem a forma esperada (achado: %)', v_def;
  END IF;
  -- prova estrutural direta: bordas rejeitadas, conteúdo real aceito
  IF (' Centro' !~ '^[[:space:]]') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: expressao de borda inicial estruturalmente errada';
  END IF;
  IF ('Centro ' !~ '[[:space:]]$') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: expressao de borda final estruturalmente errada';
  END IF;
  IF NOT ('Centro' !~ '^[[:space:]]' AND 'Centro' !~ '[[:space:]]$') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: expressao de borda rejeita conteudo legitimo sem espacos';
  END IF;
  -- CHECK anterior, GENERATED, UNIQUE piso preservados
  IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.neighborhood_aliases'::regclass
      AND conname IN ('chk_neighborhood_aliases_alias_nonempty','uq_neighborhood_aliases_parent_normalized')) <> 2 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: constraints preexistentes da N2-B foram alteradas';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='neighborhood_aliases' AND column_name='alias_normalized'
                   AND generation_expression ILIKE '%normalize_name(alias)%') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: GENERATED de alias_normalized foi alterado';
  END IF;
  -- HOLD/imutabilidade/ACL/owner/RLS de aliases intactos
  SELECT tgenabled INTO v_hold_a FROM pg_trigger
   WHERE tgrelid='public.neighborhood_aliases'::regclass AND tgname='trg_neighborhood_aliases_writer_hold';
  IF v_hold_a IS DISTINCT FROM 'A' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: HOLD de aliases alterado durante a N2-B.1';
  END IF;
  SELECT tgenabled INTO v_immut_a FROM pg_trigger
   WHERE tgrelid='public.neighborhood_aliases'::regclass AND tgname='trg_neighborhood_alias_identity_immutability';
  IF v_immut_a IS NULL OR v_immut_a NOT IN ('O','A') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: imutabilidade de aliases alterada durante a N2-B.1';
  END IF;
  IF has_table_privilege('unificard_app','public.neighborhood_aliases','INSERT')
     OR has_table_privilege('unificard_app','public.neighborhood_aliases','UPDATE')
     OR has_table_privilege('unificard_app','public.neighborhood_aliases','DELETE')
     OR has_table_privilege('unificard_app','public.neighborhood_aliases','TRUNCATE')
     OR NOT has_table_privilege('unificard_app','public.neighborhood_aliases','SELECT') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: ACL de aliases mudou durante a N2-B.1';
  END IF;
  SELECT tableowner INTO v_owner FROM pg_tables WHERE tablename='neighborhood_aliases';
  IF v_owner IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: owner de aliases mudou durante a N2-B.1 (owner=%)', v_owner;
  END IF;
  IF (SELECT relrowsecurity FROM pg_class WHERE relname='neighborhood_aliases') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: RLS ligada em aliases';
  END IF;
  -- catálogos vazios; núcleo intocado
  IF (SELECT count(*) FROM neighborhood_aliases) <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: neighborhood_aliases deveria continuar VAZIA';
  END IF;
  IF (SELECT count(*) FROM neighborhoods) <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: neighborhoods deveria continuar VAZIA';
  END IF;
END $$;

COMMIT;
