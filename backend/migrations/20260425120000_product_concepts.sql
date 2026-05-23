-- Semantic product layer (distinct from domain table `concepts`).
-- Optional FK from canonical_products; no fingerprint; no tenant on product_concepts (global semantics).

BEGIN;

CREATE TABLE product_concepts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  canonical_name TEXT NOT NULL,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_concepts_canonical_name ON product_concepts (canonical_name);

CREATE OR REPLACE FUNCTION product_concepts_bump_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_product_concepts_updated_at
  BEFORE UPDATE ON product_concepts
  FOR EACH ROW
  EXECUTE FUNCTION product_concepts_bump_updated_at();

ALTER TABLE canonical_products
  ADD COLUMN IF NOT EXISTS product_concept_id UUID
    REFERENCES product_concepts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_canonical_products_product_concept_id
  ON canonical_products (product_concept_id)
  WHERE product_concept_id IS NOT NULL;

COMMENT ON TABLE product_concepts IS
  'Semantic identity for trade items; not domain concepts, not fingerprint. Backfill and dedupe in later phases.';

COMMENT ON COLUMN product_concepts.canonical_name IS
  'Normalized display key for the concept (policy TBD); not the operational fingerprint.';

COMMENT ON COLUMN canonical_products.product_concept_id IS
  'Optional link to product_concepts; null until attribution pipeline runs.';

COMMIT;
