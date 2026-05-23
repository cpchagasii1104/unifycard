-- ============================================================
-- Marketplace: preços base por variante (SPRINT 48 / §9)
-- Alinhado a product-price.repository.ts (valid_from / valid_to).
-- ============================================================

BEGIN;

CREATE TABLE product_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL
    REFERENCES tenants(id) ON DELETE CASCADE,
  product_variant_id UUID NOT NULL
    REFERENCES product_variants(id) ON DELETE CASCADE,
  price NUMERIC(20, 2) NOT NULL CHECK (price >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_prices_tenant ON product_prices (tenant_id);
CREATE INDEX idx_product_prices_variant ON product_prices (tenant_id, product_variant_id);
CREATE INDEX idx_product_prices_validity
  ON product_prices (tenant_id, product_variant_id, valid_from, valid_to);

ALTER TABLE product_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_prices_rls ON product_prices
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE OR REPLACE FUNCTION product_prices_bump_updated_at()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_product_prices_updated_at
  BEFORE UPDATE ON product_prices
  FOR EACH ROW
  EXECUTE FUNCTION product_prices_bump_updated_at();

COMMENT ON TABLE product_prices IS
  'Preço base declarativo por variante; resolvido antes do pedido (snapshot no item).';

COMMIT;
