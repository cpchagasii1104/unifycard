BEGIN;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'schema_version'
      AND column_name = 'applied_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE schema_version
      ALTER COLUMN applied_at TYPE TIMESTAMPTZ
      USING applied_at AT TIME ZONE 'UTC';
  END IF;
END $$;

COMMIT;
