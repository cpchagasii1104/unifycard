-- ============================================================
-- FASE X — Bloco 3: Store Products / Activations
-- ============================================================
-- Tabelas: products (referenciada por product.repository), store_product_activations
-- FK store: actors só tem PK em id — não usar (tenant_id, id) em actors (42830).
-- ============================================================

-- products: catálogo de produtos (compatível com product.repository onde aplicável)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  price_cents BIGINT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  category_id UUID,
  product_type TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT products_tenant_id_id_unique UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_tenant_status ON products(tenant_id, status);

-- store_product_activations: ativação de produto por loja (store = actor)
CREATE TABLE store_product_activations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  store_id UUID NOT NULL REFERENCES actors(id),
  product_id UUID NOT NULL REFERENCES products(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at TIMESTAMPTZ,
  CONSTRAINT store_product_activations_tenant_store_product_unique UNIQUE (tenant_id, store_id, product_id)
);

CREATE INDEX idx_store_product_activations_tenant_store ON store_product_activations(tenant_id, store_id);
CREATE INDEX idx_store_product_activations_product ON store_product_activations(product_id);
CREATE INDEX idx_store_product_activations_status ON store_product_activations(status);
