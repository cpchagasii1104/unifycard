BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS total_quantity NUMERIC(20,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ;

UPDATE orders
  SET "createdAt" = created_at,
      "updatedAt" = updated_at
  WHERE "createdAt" IS NULL;

ALTER TABLE orders
  ALTER COLUMN "createdAt" SET NOT NULL,
  ALTER COLUMN "updatedAt" SET NOT NULL,
  ALTER COLUMN "createdAt" SET DEFAULT now(),
  ALTER COLUMN "updatedAt" SET DEFAULT now();

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'draft', 'submitted', 'cancelled', 'expired',
    'pending', 'processing', 'completed', 'failed'
  ));

CREATE OR REPLACE FUNCTION orders_bump_updated_at()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
  NEW."updatedAt" = now();
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION orders_bump_updated_at();

COMMIT;
