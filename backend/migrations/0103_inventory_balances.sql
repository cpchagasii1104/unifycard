-- ============================================================
-- 0103: inventory_balances (read model derivado de movements)
-- ============================================================
-- Pré-requisitos: 0002 tenants, 0101 product_variants, 0102 inventory_movements
-- Reconciliação: archive 0616 — tenants(id), FK composta tenant+variante
-- SSOT de quantidade = inventory_movements; esta tabela é projeção/cache.
-- Alinhado a inventory-balance.repository.ts (updated_at, ON CONFLICT product_variant_id).
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'product_variants'::regclass
      AND conname = 'product_variants_tenant_id_id_key'
  ) THEN
    ALTER TABLE product_variants
      ADD CONSTRAINT product_variants_tenant_id_id_key UNIQUE (tenant_id, id);
  END IF;
END $$;

CREATE TABLE inventory_balances (
  product_variant_id UUID PRIMARY KEY
    REFERENCES product_variants(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL
    REFERENCES tenants(id) ON DELETE CASCADE,
  current_quantity NUMERIC(20, 4) NOT NULL DEFAULT 0,
  unit VARCHAR(50) NOT NULL DEFAULT 'un',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_inventory_balances_variant_tenant
    FOREIGN KEY (tenant_id, product_variant_id)
    REFERENCES product_variants(tenant_id, id)
    ON DELETE CASCADE
);

CREATE INDEX idx_inventory_balances_tenant
  ON inventory_balances (tenant_id);

COMMENT ON TABLE inventory_balances IS
  'Read model opcional: saldo derivado de inventory_movements. SSOT = movements; pode ser recalculado.';

COMMENT ON COLUMN inventory_balances.current_quantity IS
  'Projeção do ledger; manutenção via aplicação (upsert após movimento), não edição manual arbitrária.';

COMMENT ON COLUMN inventory_balances.updated_at IS
  'Última atualização do read model.';

ALTER TABLE inventory_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_balances_rls ON inventory_balances
  USING (tenant_id::text = current_setting('app.current_tenant', true));

COMMIT;
