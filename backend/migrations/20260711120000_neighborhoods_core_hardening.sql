-- 20260711120000_neighborhoods_core_hardening.sql
-- F-NEIGHBORHOOD-CANONICAL-IDENTITY · N2-A.1 — SANEAMENTO das ressalvas Yala da N2-A.
-- Forward-only: a migration aplicada 20260711110000 NAO e editada.
--
-- R1 (Yala): btrim(col) <> '' nao rejeita texto so de tab/newline (btrim sem 2o argumento remove
--     apenas espacos) — source_reference/evidence podiam nascer semanticamente vazios.
--     FIX: DROP + recriacao dos DOIS CHECKs com os MESMOS nomes canonicos, exigindo ao menos um
--     caractere nao-whitespace: col ~ '[^[:space:]]'.
-- N2 (Yala): a mensagem do bloqueio de DELETE dizia "extincao = desativacao + evento de sucessao",
--     excedendo a decisao — extincao pode NAO ter sucessor; sucessao so existe quando houver
--     relacao territorial real (N2-C). FIX: CREATE OR REPLACE da funcao de imutabilidade com a
--     MESMA logica (5 bloqueios identicos, mesmos erros estaveis) e apenas o texto explicativo do
--     DELETE corrigido. Esta e a REDEFINICAO AUTORIZADA — o guard passa a trata-la como definicao
--     canonica vigente e proibe redefinicoes posteriores.
-- N1 (racional, documentado): HOLD temporario N2-pre = tgenabled 'A' (ENABLE ALWAYS) porque
--     protege tambem o fluxo dev administrativo enquanto nao ha writer. Imutabilidade permanente
--     = tgenabled 'O' (ordinario), seguindo o precedente dos freeze/immutability triggers do repo
--     (business_template_versions_freeze, btfp_immutability, tax_types_immutability):
--     unificard_app e NOSUPERUSER e nao pode alterar session_replication_role; 'A' nao impediria
--     um superuser deliberado de remover o trigger via DDL de qualquer forma. Controles
--     complementares = guard versionado + introspecao viva; antes de remover o HOLD no N2-E, o
--     trigger permanente sera novamente introspectado. ('O' NAO impede DDL administrativo — nada
--     impede; a contencao completa e migration + guard + inspecao viva.)
--
-- Escopo negativo: sem writer, sem DML liberado, HOLD intocado, sem alias/sucessao/authority/
-- seed, addresses intocada, Social/Bank fora.

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
    RAISE EXCEPTION 'MIGRATION_ABORT: neighborhoods deveria estar VAZIA (recriar CHECK exige catalogo vazio ou plano de validacao)';
  END IF;
  IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.neighborhoods'::regclass
      AND conname IN ('chk_neighborhoods_source_reference_nonempty','chk_neighborhoods_evidence_nonempty')) <> 2 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: CHECKs nonempty originais ausentes — shape N2-A inesperado';
  END IF;
  SELECT tgenabled INTO v_hold FROM pg_trigger
   WHERE tgrelid='public.neighborhoods'::regclass AND tgname='trg_neighborhoods_canonical_writer_hold';
  IF v_hold IS DISTINCT FROM 'A' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: HOLD N2-pre nao esta ENABLE ALWAYS (tgenabled=%)', COALESCE(v_hold::text,'ausente');
  END IF;
  SELECT tgenabled INTO v_immut FROM pg_trigger
   WHERE tgrelid='public.neighborhoods'::regclass AND tgname='trg_neighborhood_identity_immutability';
  IF v_immut IS NULL OR v_immut NOT IN ('O','A') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: trigger de imutabilidade ausente ou rebaixado (tgenabled=%)', COALESCE(v_immut::text,'ausente');
  END IF;
  IF has_table_privilege('unificard_app','public.neighborhoods','INSERT')
     OR has_table_privilege('unificard_app','public.neighborhoods','UPDATE')
     OR has_table_privilege('unificard_app','public.neighborhoods','DELETE')
     OR NOT has_table_privilege('unificard_app','public.neighborhoods','SELECT') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: ACL de unificard_app divergente do esperado';
  END IF;
  IF (SELECT relrowsecurity FROM pg_class WHERE relname='neighborhoods') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: RLS ligada em catalogo global';
  END IF;
END $$;

-- ── 1. R1: CHECKs de conteúdo NÃO-whitespace (mesmos nomes canônicos) ────────────────────────
ALTER TABLE neighborhoods
  DROP CONSTRAINT chk_neighborhoods_source_reference_nonempty,
  ADD CONSTRAINT chk_neighborhoods_source_reference_nonempty
    CHECK (source_reference ~ '[^[:space:]]'),
  DROP CONSTRAINT chk_neighborhoods_evidence_nonempty,
  ADD CONSTRAINT chk_neighborhoods_evidence_nonempty
    CHECK (evidence ~ '[^[:space:]]');

COMMENT ON CONSTRAINT chk_neighborhoods_source_reference_nonempty ON neighborhoods IS
  'N2-A.1 (ressalva Yala R1): exige ao menos um caractere nao-whitespace — btrim() sem 2o argumento so remove espacos e aceitava tab/newline-only.';
COMMENT ON CONSTRAINT chk_neighborhoods_evidence_nonempty ON neighborhoods IS
  'N2-A.1 (ressalva Yala R1): exige ao menos um caractere nao-whitespace — btrim() sem 2o argumento so remove espacos e aceitava tab/newline-only.';

-- ── 2. N2: REDEFINIÇÃO AUTORIZADA da função de imutabilidade (mesma lógica; só o texto do DELETE) ─
-- Cinco bloqueios IDENTICOS, mesmos erros estaveis, mesmo search_path, sem bypass, RETURN NEW.
-- Unica mudanca: a mensagem do DELETE nao afirma mais que toda extincao exige sucessao.
CREATE OR REPLACE FUNCTION enforce_neighborhood_identity_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'NEIGHBORHOOD_IDENTITY_DELETE_FORBIDDEN: bairro canonico nunca e deletado fisicamente '
      '(DECISION-0172 §2) — extincao usa vigencia/desativacao (valid_until_at + is_active=false); '
      'sucessao e registrada somente quando houver relacao territorial real governada (N2-C).'
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
  'N2-A.1 (definicao canonica VIGENTE; redefinicao autorizada pela remediacao Yala — apenas o texto '
  'do DELETE mudou; logica identica a N2-A): imutabilidade PERMANENTE — DELETE proibido; '
  'neighborhood_id/city_id/created_by_actor_id/created_at imutaveis. Trigger ordinario (tgenabled=O) '
  'por precedente dos immutability triggers do repo: unificard_app e NOSUPERUSER (nao altera '
  'session_replication_role); ENABLE ALWAYS nao impediria DDL de superuser deliberado; controles '
  'complementares = guard versionado + introspecao viva (re-inspecao obrigatoria antes de remover o '
  'HOLD no N2-E). Sem GUC/role/bypass. Redefinicoes posteriores = PROIBIDAS pelo guard.';

-- ── 3. FAIL-CLOSED PÓS ───────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_hold "char";
  v_immut "char";
  v_def text;
BEGIN
  -- CHECKs fortalecidos vivos e com a forma correta
  IF (SELECT count(*) FROM pg_constraint
      WHERE conrelid='public.neighborhoods'::regclass
        AND conname IN ('chk_neighborhoods_source_reference_nonempty','chk_neighborhoods_evidence_nonempty')
        AND pg_get_constraintdef(oid) LIKE '%[^[:space:]]%') <> 2 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: CHECKs fortalecidos ausentes ou com forma divergente';
  END IF;
  -- prova estrutural: whitespace-only NAO pode ser aceitavel
  IF (E'\n\t ' ~ '[^[:space:]]') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: expressao de whitespace estruturalmente errada';
  END IF;
  IF NOT ('x' ~ '[^[:space:]]') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: expressao rejeita conteudo legitimo';
  END IF;
  -- funcao vigente contem os 5 bloqueios e nao contem bypass
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc WHERE proname='enforce_neighborhood_identity_immutability';
  IF v_def IS NULL
     OR v_def NOT LIKE '%NEIGHBORHOOD_IDENTITY_DELETE_FORBIDDEN%'
     OR v_def NOT LIKE '%NEIGHBORHOOD_IDENTITY_ID_IMMUTABLE%'
     OR v_def NOT LIKE '%NEIGHBORHOOD_IDENTITY_CITY_IMMUTABLE%'
     OR v_def NOT LIKE '%NEIGHBORHOOD_IDENTITY_CREATOR_IMMUTABLE%'
     OR v_def NOT LIKE '%NEIGHBORHOOD_IDENTITY_CREATED_AT_IMMUTABLE%' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: funcao de imutabilidade perdeu bloqueio na redefinicao';
  END IF;
  IF v_def ILIKE '%current_setting%' OR v_def ILIKE '%pg_has_role%' OR v_def ILIKE '%session_user%' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: funcao de imutabilidade ganhou bypass';
  END IF;
  -- mensagem de extincao nao pode mais tornar sucessao obrigatoria
  IF v_def LIKE '%desativacao + evento de sucessao%' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: mensagem de extincao nao foi corrigida';
  END IF;
  -- triggers integros
  SELECT tgenabled INTO v_immut FROM pg_trigger
   WHERE tgrelid='public.neighborhoods'::regclass AND tgname='trg_neighborhood_identity_immutability';
  IF v_immut IS NULL OR v_immut NOT IN ('O','A') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: trigger de imutabilidade ausente/DISABLED/REPLICA (tgenabled=%)', COALESCE(v_immut::text,'ausente');
  END IF;
  SELECT tgenabled INTO v_hold FROM pg_trigger
   WHERE tgrelid='public.neighborhoods'::regclass AND tgname='trg_neighborhoods_canonical_writer_hold';
  IF v_hold IS DISTINCT FROM 'A' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: HOLD alterado durante a N2-A.1 (tgenabled=%)', COALESCE(v_hold::text,'ausente');
  END IF;
  -- ACL e catalogo intactos
  IF has_table_privilege('unificard_app','public.neighborhoods','INSERT')
     OR has_table_privilege('unificard_app','public.neighborhoods','UPDATE')
     OR has_table_privilege('unificard_app','public.neighborhoods','DELETE')
     OR NOT has_table_privilege('unificard_app','public.neighborhoods','SELECT') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: ACL mudou durante a N2-A.1';
  END IF;
  IF (SELECT count(*) FROM neighborhoods) <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: neighborhoods deveria continuar VAZIA';
  END IF;
END $$;

COMMIT;
