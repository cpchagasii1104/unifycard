-- ============================================================
-- 0101: product_variants (MARKETPLACE — unidade operacional de catálogo)
-- ============================================================
-- Pré-requisitos: 0002 tenants, 0020 products (UNIQUE (tenant_id, id))
-- Reconciliação: archive 0356 — ajustado a tenants(id), timestamps camelCase
--   (alinhado a product-variant.repository.ts e tabela products).
-- SSOT semântico de “o que é” continua CONCEPT (Lei 7); SKU/PLU são operacionais,
--   não substituem concept_id em categorias.
-- ============================================================

BEGIN;

CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL
    REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  sku VARCHAR(255) NOT NULL,
  plu VARCHAR(255),
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_variant_sku_per_tenant UNIQUE (tenant_id, sku),
  CONSTRAINT fk_product_variants_product_scoped
    FOREIGN KEY (tenant_id, product_id)
    REFERENCES products(tenant_id, id)
    ON DELETE CASCADE
);

CREATE INDEX idx_product_variants_tenant ON product_variants (tenant_id);
CREATE INDEX idx_product_variants_product ON product_variants (tenant_id, product_id);
CREATE INDEX idx_product_variants_active ON product_variants (tenant_id, is_active) WHERE is_active = true;
CREATE INDEX idx_product_variants_sku ON product_variants (tenant_id, sku);
CREATE INDEX idx_product_variants_plu ON product_variants (tenant_id, plu) WHERE plu IS NOT NULL;

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_variants_rls ON product_variants
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE OR REPLACE FUNCTION product_variants_bump_updated_at()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION product_variants_bump_updated_at();

COMMENT ON TABLE product_variants IS
  'Variantes de produto (SKU/PLU). Unidade operacional para estoque e pedidos; identidade semântica do domínio = CONCEPT.';

COMMENT ON COLUMN product_variants.sku IS
  'SKU único por tenant; identificador operacional da variante (não é SSOT semântico).';

COMMIT;
