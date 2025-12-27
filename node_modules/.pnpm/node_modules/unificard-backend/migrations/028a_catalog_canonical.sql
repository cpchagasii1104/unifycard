-- 028_catalog_canonical.sql
-- Catálogo Canônico Híbrido: produtos industriais, ofertas e produtos locais

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Função para atualizar updated_at (se não existir)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- CANONICAL_PRODUCTS (produtos industriais com GTIN)
-- =========================================================
CREATE TABLE IF NOT EXISTS canonical_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  gtin VARCHAR(50) NOT NULL, -- Global Trade Item Number
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(100),
  images TEXT[] DEFAULT '{}',
  attributes JSONB DEFAULT '{}',
  category_id UUID,
  type VARCHAR(20) NOT NULL DEFAULT 'INDUSTRIAL',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(tenant_id, gtin)
);

ALTER TABLE canonical_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY canonical_products_rls ON canonical_products
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE INDEX idx_canonical_products_tenant ON canonical_products(tenant_id);
CREATE INDEX idx_canonical_products_gtin ON canonical_products(gtin);
CREATE INDEX idx_canonical_products_category ON canonical_products(tenant_id, category_id);
CREATE INDEX idx_canonical_products_name ON canonical_products(tenant_id, name);
CREATE INDEX idx_canonical_products_type ON canonical_products(tenant_id, type);

-- =========================================================
-- PRODUCT_OFFERS (ofertas de produtos por merchant)
-- =========================================================
CREATE TABLE IF NOT EXISTS product_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  product_id UUID NOT NULL REFERENCES canonical_products(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL, -- FK para merchants/users
  price NUMERIC(10,2) NOT NULL,
  stock INTEGER,
  location_region_id UUID,
  location_city_id UUID,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE product_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_offers_rls ON product_offers
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE INDEX idx_product_offers_tenant ON product_offers(tenant_id);
CREATE INDEX idx_product_offers_product ON product_offers(tenant_id, product_id);
CREATE INDEX idx_product_offers_merchant ON product_offers(tenant_id, merchant_id);
CREATE INDEX idx_product_offers_region ON product_offers(tenant_id, location_region_id);
CREATE INDEX idx_product_offers_city ON product_offers(tenant_id, location_city_id);
CREATE INDEX idx_product_offers_active ON product_offers(tenant_id, active);

-- =========================================================
-- LOCAL_PRODUCTS (produtos locais sem GTIN)
-- =========================================================
CREATE TABLE IF NOT EXISTS local_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  merchant_id UUID NOT NULL, -- FK para merchants/users
  name VARCHAR(255) NOT NULL,
  description TEXT,
  images TEXT[] DEFAULT '{}',
  attributes JSONB DEFAULT '{}',
  category_id UUID,
  type VARCHAR(20) NOT NULL DEFAULT 'LOCAL',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE local_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY local_products_rls ON local_products
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE INDEX idx_local_products_tenant ON local_products(tenant_id);
CREATE INDEX idx_local_products_merchant ON local_products(tenant_id, merchant_id);
CREATE INDEX idx_local_products_category ON local_products(tenant_id, category_id);
CREATE INDEX idx_local_products_name ON local_products(tenant_id, name);
CREATE INDEX idx_local_products_type ON local_products(tenant_id, type);

-- =========================================================
-- TRIGGERS para updated_at
-- =========================================================
CREATE TRIGGER trg_canonical_products_updated_at
  BEFORE UPDATE ON canonical_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_product_offers_updated_at
  BEFORE UPDATE ON product_offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_local_products_updated_at
  BEFORE UPDATE ON local_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

