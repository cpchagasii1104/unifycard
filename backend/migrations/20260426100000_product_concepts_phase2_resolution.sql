-- Phase 2: controlled concept resolution (exact normalized_name match; no auto-create; fingerprint unchanged).

BEGIN;

ALTER TABLE product_concepts
  ADD COLUMN IF NOT EXISTS normalized_name TEXT,
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5, 4);

UPDATE product_concepts
SET normalized_name = lower(regexp_replace(btrim(canonical_name), '\s+', ' ', 'g'))
WHERE normalized_name IS NULL;

ALTER TABLE product_concepts
  DROP CONSTRAINT IF EXISTS product_concepts_created_by_chk;

ALTER TABLE product_concepts
  ADD CONSTRAINT product_concepts_created_by_chk
  CHECK (created_by IS NULL OR created_by IN ('system', 'manual'));

ALTER TABLE product_concepts
  DROP CONSTRAINT IF EXISTS product_concepts_confidence_score_chk;

ALTER TABLE product_concepts
  ADD CONSTRAINT product_concepts_confidence_score_chk
  CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1));

CREATE UNIQUE INDEX IF NOT EXISTS uidx_product_concepts_normalized_name
  ON product_concepts (normalized_name)
  WHERE normalized_name IS NOT NULL;

COMMENT ON COLUMN product_concepts.normalized_name IS
  'Light-normalized key for exact lookup (lower, trim, collapsed spaces); not fingerprint_v1.';

COMMENT ON COLUMN product_concepts.created_by IS
  'Provenance: system vs manual; NULL for legacy rows.';

COMMENT ON COLUMN product_concepts.confidence_score IS
  'Optional 0–1 when suggestion pipeline exists; NULL until then.';

ALTER TABLE canonical_products
  ADD COLUMN IF NOT EXISTS concept_resolution_status TEXT NOT NULL DEFAULT 'unresolved';

ALTER TABLE canonical_products
  DROP CONSTRAINT IF EXISTS canonical_products_concept_resolution_status_chk;

ALTER TABLE canonical_products
  ADD CONSTRAINT canonical_products_concept_resolution_status_chk
  CHECK (concept_resolution_status IN ('unresolved', 'auto_suggested', 'confirmed'));

COMMENT ON COLUMN canonical_products.concept_resolution_status IS
  'Semantic link state: unresolved | auto_suggested | confirmed. Independent of fingerprint_v1.';

COMMIT;
