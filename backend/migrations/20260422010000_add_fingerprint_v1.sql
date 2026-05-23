-- fingerprint_v1: identidade operacional determinística por tenant (sem concept_id nesta fase).
-- Backfill alinhado ao runtime: GTIN trim + ramo sem GTIN name|brand|attrs normalizados.

BEGIN;

CREATE OR REPLACE FUNCTION canonical_json_attrs(v JSONB)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE STRICT
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT COALESCE(
    (
      SELECT string_agg(
        key || '=' || to_jsonb(value)::text,
        '|' ORDER BY key
      )
      FROM jsonb_each(v)
    ),
    ''
  )
$$;

ALTER TABLE canonical_products
  ADD COLUMN IF NOT EXISTS fingerprint_v1 TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_canonical_products_fingerprint_v1
  ON canonical_products (tenant_id, fingerprint_v1)
  WHERE fingerprint_v1 IS NOT NULL;

UPDATE canonical_products
SET fingerprint_v1 = md5(
  CASE
    WHEN NULLIF(btrim(gtin), '') IS NOT NULL THEN btrim(gtin)
    ELSE lower(btrim(name))
         || '|'
         || lower(btrim(coalesce(brand, '')))
         || '|'
         || canonical_json_attrs(coalesce(attributes, '{}'::jsonb))
  END
)
WHERE fingerprint_v1 IS NULL;

COMMENT ON COLUMN canonical_products.fingerprint_v1 IS
  'MD5 hex determinístico: com GTIN → hash(GTIN trim); sem GTIN → hash(name|brand|canonical_attrs). Idempotência + anti-corrida via uidx_canonical_products_fingerprint_v1.';

COMMIT;
