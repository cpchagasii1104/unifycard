BEGIN;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'inventory_reservations'
      AND column_name  = 'expiresAt'
  ) THEN
    ALTER TABLE inventory_reservations RENAME COLUMN "expiresAt" TO expires_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'fulfillment_orders'
      AND column_name  = 'shippedAt'
  ) THEN
    ALTER TABLE fulfillment_orders RENAME COLUMN "shippedAt" TO shipped_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'pdv_sessions'
      AND column_name  = 'closedAt'
  ) THEN
    ALTER TABLE pdv_sessions RENAME COLUMN "closedAt" TO closed_at;
  END IF;
END $$;

COMMIT;
