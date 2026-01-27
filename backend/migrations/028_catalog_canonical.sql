/*
Arquivo: 028_catalog_canonical.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Escopo: Catálogo Canônico Híbrido

Objetivo:
- Produtos industriais (GTIN)
- Produtos locais (sem GTIN)
- Ofertas por merchant

Dependências:
- tenants
- função update_updated_at_column()
- extensão uuid-ossp
*/

-- =========================================================
-- EXTENSÕES
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================
-- CANONICAL_PRODUCTS (produtos industriais)
-- =========================================================

CREATE TABLE IF NOT EXISTS canonical_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id)
    ON DELETE CASCADE,

  gtin VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(100),

  images TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,

  category_id UUID,
  type VARCHAR(20) NOT NULL DEFAULT 'INDUSTRIAL',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT canonical_products_type_chk
    CHECK (type IN ('INDUSTRIAL')),

  UNIQUE (tenant_id, gtin)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_canonical_products_tenant
  ON canonical_products (tenant_id);

CREATE INDEX IF NOT EXISTS idx_canonical_products_gtin
  ON canonical_products (gtin);

CREATE INDEX IF NOT EXISTS idx_canonical_products_category
  ON canonical_products (tenant_id, category_id);

CREATE INDEX IF NOT EXISTS idx_canonical_products_name
  ON canonical_products (tenant_id, name);

CREATE INDEX IF NOT EXISTS idx_canonical_products_type
  ON canonical_products (tenant_id, type);

-- RLS
ALTER TABLE canonical_products ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'canonical_products'
      AND policyname = 'canonical_products_rls'
  ) THEN
    CREATE POLICY canonical_products_rls
      ON canonical_products
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_canonical_products_updated_at
  ON canonical_products;

CREATE TRIGGER trg_canonical_products_updated_at
  BEFORE UPDATE ON canonical_products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- PRODUCT_OFFERS (ofertas por merchant)
-- =========================================================

CREATE TABLE IF NOT EXISTS product_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id)
    ON DELETE CASCADE,

  product_id UUID NOT NULL
    REFERENCES canonical_products(id)
    ON DELETE CASCADE,

  merchant_id UUID NOT NULL,

  price NUMERIC(10,2) NOT NULL
    CHECK (price >= 0),

  stock INTEGER
    CHECK (stock IS NULL OR stock >= 0),

  location_region_id UUID,
  location_city_id   UUID,

  active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_product_offers_tenant
  ON product_offers (tenant_id);

CREATE INDEX IF NOT EXISTS idx_product_offers_product
  ON product_offers (tenant_id, product_id);

CREATE INDEX IF NOT EXISTS idx_product_offers_merchant
  ON product_offers (tenant_id, merchant_id);

CREATE INDEX IF NOT EXISTS idx_product_offers_region
  ON product_offers (tenant_id, location_region_id);

CREATE INDEX IF NOT EXISTS idx_product_offers_city
  ON product_offers (tenant_id, location_city_id);

CREATE INDEX IF NOT EXISTS idx_product_offers_active
  ON product_offers (tenant_id, active);

-- RLS
ALTER TABLE product_offers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'product_offers'
      AND policyname = 'product_offers_rls'
  ) THEN
    CREATE POLICY product_offers_rls
      ON product_offers
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_product_offers_updated_at
  ON product_offers;

CREATE TRIGGER trg_product_offers_updated_at
  BEFORE UPDATE ON product_offers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- LOCAL_PRODUCTS (produtos locais)
-- =========================================================

CREATE TABLE IF NOT EXISTS local_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id)
    ON DELETE CASCADE,

  merchant_id UUID NOT NULL,

  name VARCHAR(255) NOT NULL,
  description TEXT,

  images TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,

  category_id UUID,
  type VARCHAR(20) NOT NULL DEFAULT 'LOCAL',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT local_products_type_chk
    CHECK (type IN ('LOCAL'))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_local_products_tenant
  ON local_products (tenant_id);

CREATE INDEX IF NOT EXISTS idx_local_products_merchant
  ON local_products (tenant_id, merchant_id);

CREATE INDEX IF NOT EXISTS idx_local_products_category
  ON local_products (tenant_id, category_id);

CREATE INDEX IF NOT EXISTS idx_local_products_name
  ON local_products (tenant_id, name);

CREATE INDEX IF NOT EXISTS idx_local_products_type
  ON local_products (tenant_id, type);

-- RLS
ALTER TABLE local_products ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'local_products'
      AND policyname = 'local_products_rls'
  ) THEN
    CREATE POLICY local_products_rls
      ON local_products
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_local_products_updated_at
  ON local_products;

CREATE TRIGGER trg_local_products_updated_at
  BEFORE UPDATE ON local_products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
