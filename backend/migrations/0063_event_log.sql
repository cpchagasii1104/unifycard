-- ============================================================
-- 0063: event_log (persistência do EventBus)
-- ============================================================
-- Alinha com src/core/events/event-bus.ts (INSERT ... ON CONFLICT event_id).
-- ============================================================

BEGIN;

CREATE TABLE event_log (
  event_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1,
  payload JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_log_tenant_created ON event_log (tenant_id, created_at DESC);
CREATE INDEX idx_event_log_tenant_type ON event_log (tenant_id, event_type);

ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'event_log'
      AND policyname = 'event_log_rls'
  ) THEN
    CREATE POLICY event_log_rls ON event_log
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

COMMENT ON TABLE event_log IS 'Eventos de domínio persistidos pelo EventBus (idempotência por event_id).';

COMMIT;
