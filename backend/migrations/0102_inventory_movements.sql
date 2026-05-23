-- ============================================================
-- 0102: inventory_movements (SSOT físico — ledger de quantidade)
-- ============================================================
-- Pré-requisitos: 0002 tenants, 0101 product_variants
-- Reconciliação: archive 0615 + coluna inventory_lot_id (sem FK até 0104 lots)
-- Norma: docs/01_normative/INVARIANTES_OPERACIONAIS_LEDGER.md
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_movement_type') THEN
    CREATE TYPE inventory_movement_type AS ENUM (
      'IN',
      'OUT',
      'ADJUSTMENT'
    );
  END IF;
END $$;

CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL
    REFERENCES tenants(id) ON DELETE CASCADE,
  product_variant_id UUID NOT NULL
    REFERENCES product_variants(id) ON DELETE CASCADE,
  movement_type inventory_movement_type NOT NULL,
  quantity NUMERIC(20, 4) NOT NULL,
  unit VARCHAR(50) NOT NULL DEFAULT 'un',
  reason VARCHAR(255),
  reference_type VARCHAR(100),
  reference_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  inventory_lot_id UUID,
  created_by_user_id UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT check_quantity_positive_in_out CHECK (
    (movement_type IN ('IN', 'OUT') AND quantity > 0)
    OR (movement_type = 'ADJUSTMENT')
  )
);

CREATE INDEX idx_inventory_movements_variant_created
  ON inventory_movements (product_variant_id, "createdAt" DESC);

CREATE INDEX idx_inventory_movements_tenant_created
  ON inventory_movements (tenant_id, "createdAt" DESC);

CREATE INDEX idx_inventory_movements_type
  ON inventory_movements (tenant_id, movement_type);

CREATE INDEX idx_inventory_movements_reference
  ON inventory_movements (tenant_id, reference_type, reference_id)
  WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL;

CREATE INDEX idx_inventory_movements_lot
  ON inventory_movements (tenant_id, inventory_lot_id)
  WHERE inventory_lot_id IS NOT NULL;

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_movements_rls ON inventory_movements
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE OR REPLACE FUNCTION prevent_inventory_movement_modification()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'inventory_movements is immutable (append-only). UPDATE and DELETE are forbidden.';
END;
$$;

CREATE TRIGGER prevent_inventory_movements_update
  BEFORE UPDATE ON inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION prevent_inventory_movement_modification();

CREATE TRIGGER prevent_inventory_movements_delete
  BEFORE DELETE ON inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION prevent_inventory_movement_modification();

COMMENT ON TABLE inventory_movements IS
  'Movimentações de estoque (append-only). SSOT de quantidade; saldo derivado por soma.';

COMMENT ON COLUMN inventory_movements.inventory_lot_id IS
  'Opcional. FK para inventory_lots será aplicada quando a tabela de lotes existir (migration posterior).';

COMMIT;
