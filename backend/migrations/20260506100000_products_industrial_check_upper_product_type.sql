-- Endurece CHECK 5B: comparar product_type em maiúsculas (fecha brecha 'industrial' vs 'INDUSTRIAL').
-- Alinha aderência formal a 07 §18.14 + Fase 5A (normalização uppercase).

BEGIN;

ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_industrial_requires_canonical;

ALTER TABLE products
  ADD CONSTRAINT chk_products_industrial_requires_canonical
  CHECK (
    UPPER(TRIM(product_type)) IS DISTINCT FROM 'INDUSTRIAL'
    OR canonical_product_id IS NOT NULL
  );

COMMIT;
