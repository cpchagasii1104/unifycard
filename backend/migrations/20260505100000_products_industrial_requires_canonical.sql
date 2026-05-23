-- Fase 5B: produto INDUSTRIAL obriga canonical_product_id (blindagem no Postgres).
-- Pré-requisito: 0 linhas com product_type = 'INDUSTRIAL' AND canonical_product_id IS NULL.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_products_industrial_requires_canonical'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT chk_products_industrial_requires_canonical
      CHECK (
        product_type != 'INDUSTRIAL'
        OR canonical_product_id IS NOT NULL
      );
  END IF;
END $$;

COMMIT;
