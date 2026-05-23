-- Variante explícita do comprador (deliver / IN). Mesmo padrão que 20260404120000 (subquery no SET).
BEGIN;

ALTER TABLE b2b_order_items
  ADD COLUMN IF NOT EXISTS buyer_product_variant_id UUID REFERENCES product_variants (id) ON DELETE RESTRICT;

UPDATE b2b_order_items AS i
SET buyer_product_variant_id = (
  SELECT pv.id
  FROM b2b_orders o
  INNER JOIN product_variants pv ON pv.tenant_id = o.buyer_tenant_id
  INNER JOIN products p
    ON p.tenant_id = pv.tenant_id AND p.id = pv.product_id
  WHERE o.id = i.b2b_order_id
    AND p.canonical_product_id IS NOT DISTINCT FROM i.canonical_product_id
    AND pv.is_active = true
  ORDER BY pv.created_at ASC
  LIMIT 1
)
WHERE i.buyer_product_variant_id IS NULL;

DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM b2b_order_items WHERE buyer_product_variant_id IS NULL) THEN
    RAISE EXCEPTION 'b2b_order_items: buyer_product_variant_id obrigatório — comprador sem variante para o canônico da linha';
  END IF;
END
$guard$;

ALTER TABLE b2b_order_items
  ALTER COLUMN buyer_product_variant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_b2b_order_items_buyer_variant ON b2b_order_items (buyer_product_variant_id);

COMMENT ON COLUMN b2b_order_items.buyer_product_variant_id IS
  'Variante do comprador para movimento IN no deliver; deve partilhar canonical com product_variant_id do fornecedor.';

COMMIT;
