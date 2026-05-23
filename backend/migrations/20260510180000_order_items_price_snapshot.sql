-- PROD-6 — Snapshot de preço na linha (padrão B: sem reler product_offers após persistência).
-- Valor cobrado = price_cents × quantity (unidade de venda = sale_unit).

BEGIN;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS offer_id UUID
    REFERENCES product_offers(id) ON DELETE RESTRICT;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS price_cents BIGINT;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3);

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS sale_unit TEXT NOT NULL DEFAULT 'un';

UPDATE order_items
SET sale_unit = unit
WHERE sale_unit = 'un' AND unit IS NOT NULL AND unit <> 'un';

COMMENT ON COLUMN order_items.offer_id IS
  'Oferta (listagem merchant×produto) correlacionada no momento da linha; auditoria. Preço cobrado vem de price_cents (snapshot), não de novo SELECT na oferta.';

COMMENT ON COLUMN order_items.price_cents IS
  'Preço unitário efetivo em centavos após promoções, no momento da criação da linha (PROD-6 snapshot).';

COMMENT ON COLUMN order_items.currency IS
  'Moeda do snapshot (ISO 4217, ex. BRL).';

COMMENT ON COLUMN order_items.sale_unit IS
  'Unidade de venda no momento da linha (alinhada a product_variants.sale_unit / PROD-2).';

CREATE INDEX IF NOT EXISTS idx_order_items_offer
  ON order_items (tenant_id, offer_id)
  WHERE offer_id IS NOT NULL;

COMMIT;
