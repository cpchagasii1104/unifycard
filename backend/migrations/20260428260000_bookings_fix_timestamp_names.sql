BEGIN;

-- ============================================================
-- C11: bookings — timestamps sem sufixo _at (§07 Nomenclatura)
-- Colunas problemáticas identificadas no DDL (migration 13252):
--   requestedat → requested_at
--   confirmedat → confirmed_at
--   cancelledat → cancelled_at
--   expiredat   → expired_at
-- Forward-only. Guard IF EXISTS por coluna garante idempotência.
-- ============================================================

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'bookings'
      AND column_name  = 'requestedat'
  ) THEN
    ALTER TABLE bookings RENAME COLUMN requestedat TO requested_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'bookings'
      AND column_name  = 'confirmedat'
  ) THEN
    ALTER TABLE bookings RENAME COLUMN confirmedat TO confirmed_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'bookings'
      AND column_name  = 'cancelledat'
  ) THEN
    ALTER TABLE bookings RENAME COLUMN cancelledat TO cancelled_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'bookings'
      AND column_name  = 'expiredat'
  ) THEN
    ALTER TABLE bookings RENAME COLUMN expiredat TO expired_at;
  END IF;
END $$;

COMMIT;
