-- Aligns persisted gtin with §4.76 (btrim; empty -> NULL) before fingerprint;
-- fingerprint_v1 remains solely from canonical_product_fingerprint_v1 (trigger / application omit column).

BEGIN;

CREATE OR REPLACE FUNCTION trg_canonical_products_set_fingerprint_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  NEW.gtin := NULLIF(btrim(NEW.gtin), '');
  NEW.fingerprint_v1 := canonical_product_fingerprint_v1(
    NEW.gtin,
    NEW.name,
    NEW.brand,
    COALESCE(NEW.attributes, '{}'::jsonb)
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trg_canonical_products_set_fingerprint_v1() IS
  'Normalizes gtin (btrim, empty->NULL) then sets fingerprint_v1 via canonical_product_fingerprint_v1; see 07_NOMENCLATURA_CANONICA §4.76.';

COMMIT;
