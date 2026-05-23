-- §5.4 PLANO_FASE_ATUAL: mudança industrial relevante em canonical_products cria nova versão.
-- Campos industriais relevantes: gtin, name, brand.
-- Depende de: 20260520100000_canonical_products_governance_fields.sql (coluna version).

BEGIN;

CREATE OR REPLACE FUNCTION trg_canonical_products_version_increment()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF (NEW.gtin  IS DISTINCT FROM OLD.gtin)
  OR (NEW.name  IS DISTINCT FROM OLD.name)
  OR (NEW.brand IS DISTINCT FROM OLD.brand)
  THEN
    NEW.version := COALESCE(OLD.version, 1) + 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cpe_version_increment ON canonical_products;
CREATE TRIGGER trg_cpe_version_increment
  BEFORE UPDATE OF gtin, name, brand ON canonical_products
  FOR EACH ROW EXECUTE FUNCTION trg_canonical_products_version_increment();

COMMENT ON FUNCTION trg_canonical_products_version_increment() IS
  '§5.4 PLANO_FASE_ATUAL: incrementa version em mudanças industriais (gtin/name/brand). '
  'version nunca recua — qualquer UPDATE nos campos industriais avança o contador.';

COMMIT;
