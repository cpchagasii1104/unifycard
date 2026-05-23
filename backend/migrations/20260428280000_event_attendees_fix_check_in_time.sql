BEGIN;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'event_attendees'
      AND column_name  = 'check_in_time'
  ) THEN
    ALTER TABLE event_attendees RENAME COLUMN check_in_time TO checked_in_at;
  END IF;
END $$;

COMMIT;
