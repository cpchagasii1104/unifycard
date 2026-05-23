BEGIN;

DROP INDEX IF EXISTS idx_fulfillment_orders_status_created;

ALTER TABLE fulfillment_items
  DROP COLUMN IF EXISTS "createdAt";

ALTER TABLE fulfillment_items
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE fulfillment_orders
  DROP COLUMN IF EXISTS "createdAt",
  DROP COLUMN IF EXISTS "updatedAt",
  DROP COLUMN IF EXISTS "shippedAt";

ALTER TABLE fulfillment_orders
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_fulfillment_orders_status_created
  ON fulfillment_orders (tenant_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION fulfillment_orders_bump_updated_at()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fulfillment_orders_updated_at ON fulfillment_orders;

CREATE TRIGGER trg_fulfillment_orders_updated_at
  BEFORE UPDATE ON fulfillment_orders
  FOR EACH ROW
  EXECUTE FUNCTION fulfillment_orders_bump_updated_at();

DROP INDEX IF EXISTS idx_inventory_movements_variant_created;
DROP INDEX IF EXISTS idx_inventory_movements_tenant_created;

ALTER TABLE inventory_movements
  DROP COLUMN IF EXISTS "createdAt";

ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_inventory_movements_variant_created
  ON inventory_movements (product_variant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_tenant_created
  ON inventory_movements (tenant_id, created_at DESC);

DROP INDEX IF EXISTS idx_inventory_reservations_expires;

ALTER TABLE inventory_reservations
  DROP COLUMN IF EXISTS "createdAt",
  DROP COLUMN IF EXISTS "updatedAt",
  DROP COLUMN IF EXISTS "expiresAt";

ALTER TABLE inventory_reservations
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_expires
  ON inventory_reservations (tenant_id, status, expires_at)
  WHERE status = 'ACTIVE' AND expires_at IS NOT NULL;

CREATE OR REPLACE FUNCTION inventory_reservations_bump_updated_at()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_reservations_updated_at ON inventory_reservations;

CREATE TRIGGER trg_inventory_reservations_updated_at
  BEFORE UPDATE ON inventory_reservations
  FOR EACH ROW
  EXECUTE FUNCTION inventory_reservations_bump_updated_at();

COMMIT;
