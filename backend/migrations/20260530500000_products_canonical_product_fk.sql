-- C25: FK products.canonical_product_id → canonical_products(id)
-- Forward-only; idempotente se constraint já existir.

BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'products'::regclass
      AND conname = 'fk_products_canonical_product_id'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT fk_products_canonical_product_id
      FOREIGN KEY (canonical_product_id)
      REFERENCES canonical_products(id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
