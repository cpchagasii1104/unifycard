-- Suporte §8.4 PLANO_FASE_ATUAL: product-visibility.service.ts.
-- query dinâmica (não view materializada) — §8.4 explícito.
-- Todos com IF NOT EXISTS — idempotente.
-- Verificar existência antes de aplicar:
--   SELECT indexname FROM pg_indexes WHERE tablename IN ('product_offers','products','inventory_movements');

BEGIN;

CREATE INDEX IF NOT EXISTS idx_product_offers_active_tenant
  ON product_offers (tenant_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_products_canonical_tenant
  ON products (tenant_id, canonical_product_id)
  WHERE canonical_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_variant_tenant
  ON inventory_movements (tenant_id, product_variant_id);

COMMENT ON INDEX idx_product_offers_active_tenant IS
  'Suporte §8 PLANO_FASE_ATUAL: filtra ofertas ativas por tenant.';
COMMENT ON INDEX idx_products_canonical_tenant IS
  'Suporte §8: join products → canonical_products.';
COMMENT ON INDEX idx_inventory_movements_variant_tenant IS
  'Suporte §8: agregação de stock por variante no LATERAL.';

COMMIT;
