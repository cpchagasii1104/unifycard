-- ============================================================
-- 0074: concepts — uma única coluna `domain` = N0 (FK domains)
-- ============================================================
-- Pré-requisito: concepts.n0_domain preenchido em 100% das linhas
--   (pnpm exec tsx src/scripts/backfill-n0-from-legacy.ts --apply)
-- Remove coluna legado `domain` (tenant:uuid) e renomeia n0_domain → domain.
-- Norma: docs/01_normative/18_DOMAIN_ONTOLOGY_UNIFICARD.md
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM concepts WHERE n0_domain IS NULL) THEN
    RAISE EXCEPTION '0074: preencha 100%% de concepts.n0_domain antes (backfill-n0-from-legacy.ts)';
  END IF;
END $$;

DO $$
DECLARE
  dup INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup
  FROM (
    SELECT n0_domain, slug
    FROM concepts
    GROUP BY n0_domain, slug
    HAVING COUNT(*) > 1
  ) t;
  IF dup > 0 THEN
    RAISE EXCEPTION '0074: duplicata (n0_domain, slug) — resolver antes de migrar';
  END IF;
END $$;

ALTER TABLE concepts DROP CONSTRAINT IF EXISTS concepts_domain_slug_key;

ALTER TABLE concepts DROP COLUMN domain;

ALTER TABLE concepts RENAME COLUMN n0_domain TO domain;

ALTER TABLE concepts ALTER COLUMN domain SET NOT NULL;

ALTER TABLE concepts ADD CONSTRAINT concepts_domain_slug_key UNIQUE (domain, slug);

DROP INDEX IF EXISTS idx_concepts_n0_domain;

CREATE INDEX idx_concepts_domain ON concepts (domain);

COMMENT ON COLUMN concepts.domain IS
  'Domínio N0 oficial (FK domains). Única classificação de domínio; slug permanece auxiliar.';

COMMIT;
