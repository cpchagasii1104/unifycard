-- ============================================================
-- 0104: inventory_lots (lote / validade — opt-in)
-- ============================================================
-- Pré-requisitos: 0002 tenants, 0103 (UNIQUE product_variants tenant_id+id)
-- Reconciliação: archive 0617 — tenants(id), FK composta variante+tenant,
--   timestamps/metadata alinhados a inventory-lot.repository.ts
-- ============================================================

BEGIN;

CREATE TABLE inventory_lots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL
    REFERENCES tenants(id) ON DELETE CASCADE,
  product_variant_id UUID NOT NULL,
  lot_code VARCHAR(255) NOT NULL,
  manufacture_date DATE,
  expiration_date DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_lot_code_per_variant UNIQUE (tenant_id, product_variant_id, lot_code),
  CONSTRAINT fk_inventory_lots_variant_tenant
    FOREIGN KEY (tenant_id, product_variant_id)
    REFERENCES product_variants(tenant_id, id)
    ON DELETE CASCADE
);

CREATE INDEX idx_inventory_lots_tenant ON inventory_lots (tenant_id);

CREATE INDEX idx_inventory_lots_variant ON inventory_lots (tenant_id, product_variant_id);

CREATE INDEX idx_inventory_lots_code ON inventory_lots (tenant_id, product_variant_id, lot_code);

CREATE INDEX idx_inventory_lots_expiration ON inventory_lots (tenant_id, expiration_date)
  WHERE expiration_date IS NOT NULL;

ALTER TABLE inventory_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_lots_rls ON inventory_lots
  USING (tenant_id::text = current_setting('app.current_tenant', true));

COMMENT ON TABLE inventory_lots IS
  'Lotes (opt-in). Rastreabilidade por código/validade; estoque sem lote continua válido.';

COMMENT ON COLUMN inventory_lots.expiration_date IS
  'Informativa; não executiva — sem bloqueio automático de movimentos.';

COMMIT;
