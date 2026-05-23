-- ============================================================
-- 0062: feature_flags (por tenant)
-- ============================================================
-- Uso: config.service (getFeatureFlag, upsertFeatureFlag, list, delete).
-- ============================================================

BEGIN;

CREATE TABLE feature_flags (
  flag_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  flag_name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  rollout_percentage INTEGER NOT NULL DEFAULT 0
    CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  user_whitelist JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT feature_flags_tenant_flag_name_key UNIQUE (tenant_id, flag_name)
);

CREATE INDEX idx_feature_flags_tenant ON feature_flags (tenant_id);
CREATE INDEX idx_feature_flags_name ON feature_flags (tenant_id, flag_name);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'feature_flags'
      AND policyname = 'feature_flags_rls'
  ) THEN
    CREATE POLICY feature_flags_rls ON feature_flags
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

COMMENT ON TABLE feature_flags IS 'Feature flags por tenant (config.service).';

COMMIT;
