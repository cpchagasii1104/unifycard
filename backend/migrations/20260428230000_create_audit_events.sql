BEGIN;

CREATE TABLE IF NOT EXISTS audit_events (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type       TEXT NOT NULL,
  severity         TEXT NOT NULL,
  actor_id         UUID NULL,
  actor_type       TEXT NULL,
  company_id       UUID NULL,
  employee_id      UUID NULL,
  source           TEXT NOT NULL,
  context          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ NULL,
  resolution_note  TEXT NULL,
  CONSTRAINT chk_audit_events_severity
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT chk_audit_events_actor_type
    CHECK (actor_type IS NULL OR actor_type IN ('user', 'page', 'cultural_profile'))
);

CREATE INDEX IF NOT EXISTS idx_audit_events_unresolved
  ON audit_events (tenant_id, resolved_at, created_at DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_audit_events_severity
  ON audit_events (tenant_id, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_actor
  ON audit_events (tenant_id, actor_id)
  WHERE actor_id IS NOT NULL;

COMMENT ON TABLE audit_events IS
  'Eventos de auditoria anti-abuso (FASE 13). C31. Append-only. Alertar nao bloquear.';

CREATE TABLE IF NOT EXISTS partner_employees (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  partner_id  UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_employees_tenant
  ON partner_employees (tenant_id, id);

COMMENT ON TABLE partner_employees IS
  'Funcionarios de parceiros. C35. Uso: leitura de partner_id em audit.service.ts.';

ALTER TABLE audit_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events      FORCE ROW LEVEL SECURITY;
ALTER TABLE partner_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_employees FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_events'
      AND policyname = 'audit_events_tenant_isolation'
  ) THEN
    CREATE POLICY audit_events_tenant_isolation
      ON audit_events
      USING (tenant_id::text = current_setting('app.current_tenant_id', true));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'partner_employees'
      AND policyname = 'partner_employees_tenant_isolation'
  ) THEN
    CREATE POLICY partner_employees_tenant_isolation
      ON partner_employees
      USING (tenant_id::text = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

COMMIT;
