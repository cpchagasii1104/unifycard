-- ============================================================
-- Marketplace: promoções (SPRINT 48)
-- Obrigatório para pricing.service.getCurrentPrice (consulta após preço base).
-- Colunas VARCHAR alinhadas a promotion.repository.ts (sem ENUM PG).
-- ============================================================

BEGIN;

CREATE TABLE promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL
    REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL
    CHECK (type IN ('PERCENTAGE', 'FIXED')),
  value NUMERIC(20, 2) NOT NULL CHECK (value >= 0),
  applies_to VARCHAR(20) NOT NULL
    CHECK (applies_to IN ('VARIANT', 'CATEGORY', 'PRODUCT')),
  applies_id UUID NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_promotions_tenant ON promotions (tenant_id);
CREATE INDEX idx_promotions_applies ON promotions (tenant_id, applies_to, applies_id);
CREATE INDEX idx_promotions_validity
  ON promotions (tenant_id, is_active, valid_from, valid_to)
  WHERE is_active = true;

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY promotions_rls ON promotions
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE OR REPLACE FUNCTION promotions_bump_updated_at()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_promotions_updated_at
  BEFORE UPDATE ON promotions
  FOR EACH ROW
  EXECUTE FUNCTION promotions_bump_updated_at();

COMMENT ON TABLE promotions IS
  'Promoções declarativas aplicadas antes do pedido (PricingService).';

COMMIT;
