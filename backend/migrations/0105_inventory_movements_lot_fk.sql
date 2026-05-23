-- ============================================================
-- 0105: inventory_movements.inventory_lot_id — FK + validação
-- ============================================================
-- Pré-requisitos: 0102 inventory_movements, 0104 inventory_lots
-- Reconciliação: archive 0618 — FK explícita; trigger reforça lote ↔ variante ↔ tenant
-- ============================================================

BEGIN;

ALTER TABLE inventory_movements
  ADD CONSTRAINT fk_inventory_movements_inventory_lot
  FOREIGN KEY (inventory_lot_id)
  REFERENCES inventory_lots(id)
  ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION validate_movement_lot_variant()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.inventory_lot_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM inventory_lots il
    WHERE il.id = NEW.inventory_lot_id
      AND il.tenant_id = NEW.tenant_id
      AND il.product_variant_id = NEW.product_variant_id
  ) THEN
    RAISE EXCEPTION
      'inventory_lot_id % não pertence ao par tenant/variante do movimento',
      NEW.inventory_lot_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_validate_movement_lot_variant ON inventory_movements;

CREATE TRIGGER trigger_validate_movement_lot_variant
  BEFORE INSERT OR UPDATE OF inventory_lot_id, product_variant_id, tenant_id
  ON inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION validate_movement_lot_variant();

COMMENT ON COLUMN inventory_movements.inventory_lot_id IS
  'Lote opcional; se preenchido, deve ser do mesmo tenant e da mesma product_variant_id.';

COMMIT;
