-- Mantém fingerprint_v1 alinhado a gtin/name/brand/attributes em todo INSERT/UPDATE parcial.
-- Depende de canonical_product_fingerprint_v1 (20260422010001_add_fingerprint_v1_expression.sql).

BEGIN;

CREATE OR REPLACE FUNCTION trg_canonical_products_set_fingerprint_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  NEW.fingerprint_v1 := canonical_product_fingerprint_v1(
    NEW.gtin,
    NEW.name,
    NEW.brand,
    COALESCE(NEW.attributes, '{}'::jsonb)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_canonical_products_fingerprint_v1 ON canonical_products;

CREATE TRIGGER trg_canonical_products_fingerprint_v1
  BEFORE INSERT OR UPDATE OF gtin, name, brand, attributes
  ON canonical_products
  FOR EACH ROW
  EXECUTE FUNCTION trg_canonical_products_set_fingerprint_v1();

COMMENT ON FUNCTION trg_canonical_products_set_fingerprint_v1() IS
  'Recalcula fingerprint_v1 antes de persistir; mesma regra que INSERT da aplicação e índice uidx_canonical_products_fingerprint_v1.';

COMMIT;
