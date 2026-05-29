-- ============================================================
-- Companies — classificação primária por empresa (Fase 3B.3)
-- Desenho: docs/02_decisions/DESENHO_FASE_3B_EMPRESA_DOIS_MOMENTOS.md (commit 691b2169)
--
-- Empresa nasce em DOIS MOMENTOS:
--   Momento 1 (jurídico/inerte): companies sem classificação → primary_* NULL.
--   Momento 2 (operacional): activateCompanyOperationally() grava o par
--     (primary_company_type_id, primary_concept_id) + garante page-actor.
--
-- Classificação é POR-EMPRESA (não por-tenant). tenants.company_type_id (0115)
-- permanece como default/template; a verdade de tipo/CONCEPT da empresa fica aqui.
-- UM company_type/CONCEPT primário obrigatório para operar; multi-concept = futuro governado.
--
-- Esta migration é SCHEMA-ONLY:
--   1. companies.primary_company_type_id UUID NULL  FK company_types(id) ON DELETE RESTRICT
--   2. companies.primary_concept_id      UUID NULL  FK concepts(concept_id) ON DELETE RESTRICT
--   3. CHECK pareado: ambos NULL OU ambos NOT NULL
--   4. unique partial index: no máximo 1 page-actor por company
--
-- NÃO grava capabilities (DT D-CONCEPT/D-CONTEXT-RESOLVER). NÃO cria companies.state.
-- NÃO toca company-canonical.service (quebrado vs schema vivo — DT própria).
-- NÃO toca bank_ledger/bank_transactions/bank_splits.
--
-- Pré-requisitos: 0065 (companies), 0113 (company_types), 0114 (company_type_allowed_concepts),
--   0009/concepts, 0010 (actors.global_user_id / actor_type).
-- Reversibilidade: DROP INDEX + DROP CONSTRAINT + DROP COLUMN — additive only.
-- Blast: BAIXO — colunas nullable, par default NULL; zero rows impactadas (companies vazia em dev).
-- ============================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1+2. Colunas de classificação primária (nullable; default Momento 1 = NULL)
-- ---------------------------------------------------------------------------
ALTER TABLE companies
  ADD COLUMN primary_company_type_id UUID
    REFERENCES company_types (id) ON DELETE RESTRICT,
  ADD COLUMN primary_concept_id UUID
    REFERENCES concepts (concept_id) ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- 3. CHECK pareado: classificação é tudo-ou-nada
--    (Momento 1 = ambos NULL; Momento 2 = ambos preenchidos)
-- ---------------------------------------------------------------------------
ALTER TABLE companies
  ADD CONSTRAINT chk_companies_primary_classification_paired
  CHECK (
    (primary_company_type_id IS NULL AND primary_concept_id IS NULL)
    OR
    (primary_company_type_id IS NOT NULL AND primary_concept_id IS NOT NULL)
  );

-- ---------------------------------------------------------------------------
-- 4. Unique partial index: no máximo 1 page-actor por company.
--    Guarda defensiva antes do índice — se houver duplicata, aborta com
--    mensagem clara (não silencia dados).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT company_id, COUNT(*) AS n
      FROM actors
     WHERE actor_type = 'page'
       AND company_id IS NOT NULL
     GROUP BY company_id
    HAVING COUNT(*) > 1
  ) dupes;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'MIGRATION ABORTADA: % company(ies) têm múltiplos page-actors. '
      'Resolver manualmente antes de aplicar esta migration.',
      dup_count;
  END IF;
END $$;

CREATE UNIQUE INDEX uq_actors_company_page
  ON actors (company_id)
  WHERE actor_type = 'page'
    AND company_id IS NOT NULL;

COMMENT ON INDEX uq_actors_company_page IS
  'Garante no máximo 1 page-actor por company (Fase 3B.3). '
  'Cobre apenas actor_type=page com company_id NOT NULL.';

COMMENT ON CONSTRAINT chk_companies_primary_classification_paired ON companies IS
  'Classificação primária da empresa é tudo-ou-nada: Momento 1 (ambos NULL) '
  'ou Momento 2 operacional (ambos preenchidos). Fase 3B.3.';

COMMIT;
