-- ============================================================
-- 20260404120000: variante explícita do fornecedor em b2b_order_items
-- ============================================================
-- Hardening: elimina ambiguidade no OUT (ship). canonical_product_id
-- mantido para rastreio / deliver no comprador.
-- Backfill: primeira variante ativa do fornecedor para o canônico da linha.
-- ============================================================

BEGIN;

ALTER TABLE b2b_order_items
  ADD COLUMN IF NOT EXISTS product_variant_id UUID REFERENCES product_variants (id) ON DELETE RESTRICT;

-- PostgreSQL: num UPDATE ... FROM, o alias da tabela alvo (i) não pode ser referenciado
-- dentro de um sub-SELECT em LATERAL no FROM (erro 42P10). Subconsulta correlacionada no SET
-- preserva a mesma semântica (order → supplier_tenant → variant + canonical + is_active).
UPDATE b2b_order_items AS i
SET product_variant_id = (
  SELECT pv.id
  FROM b2b_orders o
  INNER JOIN product_variants pv ON pv.tenant_id = o.supplier_tenant_id
  INNER JOIN products p
    ON p.tenant_id = pv.tenant_id AND p.id = pv.product_id
  WHERE o.id = i.b2b_order_id
    AND p.canonical_product_id = i.canonical_product_id
    AND pv.is_active = true
  ORDER BY pv.created_at ASC
  LIMIT 1
)
WHERE i.product_variant_id IS NULL;

DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM b2b_order_items WHERE product_variant_id IS NULL) THEN
    RAISE EXCEPTION 'b2b_order_items: product_variant_id obrigatório — corrija ou apague linhas sem variante resolvível';
  END IF;
END
$guard$;

ALTER TABLE b2b_order_items
  ALTER COLUMN product_variant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_b2b_order_items_product_variant ON b2b_order_items (product_variant_id);

COMMENT ON COLUMN b2b_order_items.product_variant_id IS
  'Variante do fornecedor (SKU) para movimento OUT no ship; SSOT físico em inventory_movements.';

COMMIT;
