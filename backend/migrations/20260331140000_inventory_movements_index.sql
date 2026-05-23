-- Índice adicional para consultas por tenant + variante + tempo (read paths / relatórios).
-- Não altera dados nem invariantes de inventory_movements.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_tenant_variant_created
  ON inventory_movements (tenant_id, product_variant_id, created_at DESC);

COMMENT ON INDEX idx_inventory_movements_tenant_variant_created IS
  '20260331140000: suporte a listagens por tenant e variante ordenadas por data.';

COMMIT;
