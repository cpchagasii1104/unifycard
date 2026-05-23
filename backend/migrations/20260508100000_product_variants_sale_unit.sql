-- PROD-2: unidade canónica de venda na variante (preço / quantidade alinhados).
-- Não duplicar em product_offers; não pertence a grupo de catálogo.

BEGIN;

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS sale_unit TEXT NOT NULL DEFAULT 'un'
    CHECK (sale_unit IN ('un', 'kg', 'g', 'l', 'ml', 'hour', 'service'));

COMMENT ON COLUMN product_variants.sale_unit IS
  'Unidade de venda da variante: price_cents (product_prices / leitura de oferta) é por esta unidade. '
  'sale_unit=kg → preço por kg; sale_unit=un → preço por unidade. '
  'inventory_movements.unit deve alinhar quando a aplicação não fixa outra unidade explicitamente.';

COMMIT;
