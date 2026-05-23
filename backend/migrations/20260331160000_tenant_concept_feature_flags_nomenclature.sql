-- feature_flags.enabled → is_enabled
-- tenant_concept_offerings.active → is_active

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'feature_flags' AND column_name = 'enabled'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'feature_flags' AND column_name = 'is_enabled'
  ) THEN
    ALTER TABLE feature_flags RENAME COLUMN enabled TO is_enabled;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_tenant_concept_offerings_concept;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_concept_offerings' AND column_name = 'active'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_concept_offerings' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE tenant_concept_offerings RENAME COLUMN active TO is_active;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tenant_concept_offerings_concept
  ON tenant_concept_offerings (concept_id)
  WHERE is_active = TRUE;

COMMENT ON COLUMN feature_flags.is_enabled IS 'Flag ligada/desligada por tenant.';
COMMENT ON COLUMN tenant_concept_offerings.is_active IS 'Tenant declara oferta ativa para o concept.';

COMMIT;
