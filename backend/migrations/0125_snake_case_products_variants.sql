BEGIN;

-- Trigger antigo referencia "updatedAt"; remover antes de dropar colunas.
DROP TRIGGER IF EXISTS trg_product_variants_updated_at ON product_variants;
DROP FUNCTION IF EXISTS product_variants_bump_updated_at();

ALTER TABLE products
  DROP COLUMN IF EXISTS "createdAt",
  DROP COLUMN IF EXISTS "updatedAt";

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE product_variants
  DROP COLUMN IF EXISTS "createdAt",
  DROP COLUMN IF EXISTS "updatedAt";

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION products_bump_updated_at()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION products_bump_updated_at();

CREATE OR REPLACE FUNCTION product_variants_bump_updated_at()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION product_variants_bump_updated_at();

COMMIT;
