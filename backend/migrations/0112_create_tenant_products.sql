BEGIN;

CREATE TABLE tenant_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(id)
    ON DELETE CASCADE,

  catalog_product_id UUID NOT NULL
    REFERENCES catalog_products(id)
    ON DELETE RESTRICT,

  price NUMERIC(10,2) NOT NULL,

  availability BOOLEAN NOT NULL DEFAULT true,

  metadata JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT tenant_products_unique UNIQUE (tenant_id, catalog_product_id)
);

COMMIT;
