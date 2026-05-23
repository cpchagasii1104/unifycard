-- Fonte única do fingerprint_v1: mesma expressão no INSERT, no lookup pós-23505 e no reparo de legado.
-- Depende de canonical_json_attrs (20260422010000_add_fingerprint_v1.sql).

BEGIN;

CREATE OR REPLACE FUNCTION canonical_product_fingerprint_v1(
  p_gtin TEXT,
  p_name TEXT,
  p_brand TEXT,
  p_attributes JSONB
) RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT md5(
    CASE
      WHEN NULLIF(btrim(p_gtin), '') IS NOT NULL THEN btrim(p_gtin)
      ELSE lower(btrim(coalesce(p_name, '')))
           || '|'
           || lower(btrim(coalesce(p_brand, '')))
           || '|'
           || canonical_json_attrs(coalesce(p_attributes, '{}'::jsonb))
    END
  )
$$;

COMMENT ON FUNCTION canonical_product_fingerprint_v1(TEXT, TEXT, TEXT, JSONB) IS
  'MD5 hex alinhado a fingerprint_v1 em canonical_products (GTIN trim ou name|brand|canonical_json_attrs).';

-- Corrige linhas cujo fingerprint foi calculado fora desta expressão (ex.: divergência TS vs PG).
UPDATE canonical_products
SET fingerprint_v1 = canonical_product_fingerprint_v1(
  gtin,
  name,
  brand,
  coalesce(attributes, '{}'::jsonb)
)
WHERE fingerprint_v1 IS DISTINCT FROM canonical_product_fingerprint_v1(
  gtin,
  name,
  brand,
  coalesce(attributes, '{}'::jsonb)
);

COMMIT;
