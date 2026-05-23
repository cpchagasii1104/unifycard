-- Um `products` por (tenant, canonical) quando canonical_product_id está definido.
-- Idempotência sob concorrência (onboarding / createProduct em paralelo).
-- Se o apply falhar: existem duplicatas — deduplicar antes de reaplicar.
BEGIN;

CREATE UNIQUE INDEX uidx_products_tenant_canonical
  ON products (tenant_id, canonical_product_id)
  WHERE canonical_product_id IS NOT NULL;

COMMENT ON INDEX uidx_products_tenant_canonical IS
  'Garante no máximo um product por tenant por canonical_product_id; violação 23505 → retry com getProductByCanonicalId.';

COMMIT;
