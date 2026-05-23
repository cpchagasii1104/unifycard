BEGIN;

CREATE TABLE product_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL
    REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL
    REFERENCES products(id) ON DELETE RESTRICT,
  merchant_id UUID NOT NULL
    REFERENCES actors(id) ON DELETE RESTRICT,
  price NUMERIC(12,4) NOT NULL CHECK (price >= 0),
  stock INTEGER,
  location_region_id UUID,
  location_city_id UUID,
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_offer_product_merchant
    UNIQUE (tenant_id, product_id, merchant_id)
);

CREATE INDEX idx_product_offers_tenant ON product_offers (tenant_id);
CREATE INDEX idx_product_offers_product ON product_offers (tenant_id, product_id);
CREATE INDEX idx_product_offers_merchant ON product_offers (tenant_id, merchant_id);
CREATE INDEX idx_product_offers_active ON product_offers (tenant_id, merchant_id, active)
  WHERE active = true;

ALTER TABLE product_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_offers_rls ON product_offers
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE OR REPLACE FUNCTION product_offers_bump_updated_at()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_product_offers_updated_at
  BEFORE UPDATE ON product_offers
  FOR EACH ROW EXECUTE FUNCTION product_offers_bump_updated_at();

COMMENT ON TABLE product_offers IS
  'Oferta de produto por merchant. price em NUMERIC — RFC-003 pendente para migrar para price_cents BIGINT.';
COMMENT ON COLUMN product_offers.stock IS
  'Cache opcional de estoque disponível. Fonte de verdade: inventory_movements. Nulo = sem controle local.';

COMMIT;
