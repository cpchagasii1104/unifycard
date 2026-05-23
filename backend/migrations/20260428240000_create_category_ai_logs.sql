BEGIN;

CREATE TABLE IF NOT EXISTS category_ai_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id     UUID NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
  tenant_id       UUID NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id        UUID NULL,
  global_user_id  UUID NULL REFERENCES global_users(global_user_id) ON DELETE SET NULL,
  input_type      TEXT NOT NULL DEFAULT 'text',
  original_text   TEXT NULL,
  sanitized_text  TEXT NULL,
  text_hash       TEXT NULL,
  audio_hash      TEXT NULL,
  audio_url       TEXT NULL,
  context         TEXT NULL,
  ai_suggestion   JSONB NULL,
  ai_confidence   NUMERIC(5,4) NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uidx_category_ai_logs_category_id
    UNIQUE (category_id),
  CONSTRAINT chk_category_ai_logs_confidence
    CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1))
);

CREATE INDEX IF NOT EXISTS idx_category_ai_logs_tenant
  ON category_ai_logs (tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_category_ai_logs_actor
  ON category_ai_logs (actor_id)
  WHERE actor_id IS NOT NULL;

COMMENT ON TABLE category_ai_logs IS
  'Log de auditoria de categorias criadas por IA. C34. ON CONFLICT (category_id) = upsert por categoria.';

ALTER TABLE category_ai_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_ai_logs FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'category_ai_logs'
      AND policyname = 'category_ai_logs_tenant_isolation'
  ) THEN
    CREATE POLICY category_ai_logs_tenant_isolation
      ON category_ai_logs
      USING (
        tenant_id IS NULL OR
        tenant_id::text = current_setting('app.current_tenant_id', true)
      );
  END IF;
END $$;

COMMIT;
