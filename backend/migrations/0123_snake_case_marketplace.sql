BEGIN;

ALTER TABLE orders DROP COLUMN IF EXISTS "createdAt";
ALTER TABLE orders DROP COLUMN IF EXISTS "updatedAt";

CREATE OR REPLACE FUNCTION orders_bump_updated_at()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION orders_bump_updated_at();

ALTER TABLE order_items DROP COLUMN IF EXISTS "createdAt";
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE order_items ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

DROP INDEX IF EXISTS idx_order_status_history_order;
ALTER TABLE order_status_history DROP COLUMN IF EXISTS "createdAt";
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_status_history' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE order_status_history ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_order_status_history_order
  ON order_status_history (order_id, created_at DESC);

ALTER TABLE pdv_sessions DROP COLUMN IF EXISTS "openedAt";
ALTER TABLE pdv_sessions DROP COLUMN IF EXISTS "closedAt";
ALTER TABLE pdv_sessions DROP COLUMN IF EXISTS "createdAt";
ALTER TABLE pdv_sessions DROP COLUMN IF EXISTS "updatedAt";
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pdv_sessions' AND column_name = 'opened_at'
  ) THEN
    ALTER TABLE pdv_sessions ADD COLUMN opened_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pdv_sessions' AND column_name = 'closed_at'
  ) THEN
    ALTER TABLE pdv_sessions ADD COLUMN closed_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pdv_sessions' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE pdv_sessions ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pdv_sessions' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE pdv_sessions ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION pdv_sessions_bump_updated_at()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pdv_sessions_updated_at ON pdv_sessions;
CREATE TRIGGER trg_pdv_sessions_updated_at
  BEFORE UPDATE ON pdv_sessions
  FOR EACH ROW
  EXECUTE FUNCTION pdv_sessions_bump_updated_at();

ALTER TABLE product_offers DROP COLUMN IF EXISTS "createdAt";
ALTER TABLE product_offers DROP COLUMN IF EXISTS "updatedAt";
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_offers' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE product_offers ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_offers' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE product_offers ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION product_offers_bump_updated_at()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_offers_updated_at ON product_offers;
CREATE TRIGGER trg_product_offers_updated_at
  BEFORE UPDATE ON product_offers
  FOR EACH ROW
  EXECUTE FUNCTION product_offers_bump_updated_at();

COMMIT;
