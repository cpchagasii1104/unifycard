BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pdv_session_status') THEN
    CREATE TYPE pdv_session_status AS ENUM ('OPEN', 'CLOSED');
  END IF;
END $$;

CREATE TABLE pdv_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL
    REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL
    REFERENCES actors(id) ON DELETE RESTRICT,
  status pdv_session_status NOT NULL DEFAULT 'OPEN',
  "openedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "closedAt" TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pdv_sessions_one_open_per_actor
    EXCLUDE USING btree (tenant_id WITH =, actor_id WITH =)
    WHERE (status = 'OPEN')
);

CREATE INDEX idx_pdv_sessions_tenant ON pdv_sessions (tenant_id);
CREATE INDEX idx_pdv_sessions_actor ON pdv_sessions (tenant_id, actor_id);
CREATE INDEX idx_pdv_sessions_open ON pdv_sessions (tenant_id, actor_id, status)
  WHERE status = 'OPEN';

ALTER TABLE pdv_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY pdv_sessions_rls ON pdv_sessions
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE OR REPLACE FUNCTION pdv_sessions_bump_updated_at()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pdv_sessions_updated_at
  BEFORE UPDATE ON pdv_sessions
  FOR EACH ROW EXECUTE FUNCTION pdv_sessions_bump_updated_at();

COMMENT ON TABLE pdv_sessions IS
  'Sessões de caixa PDV. Uma sessão OPEN por operador (actor) por tenant.';
COMMENT ON COLUMN pdv_sessions."closedAt" IS
  'Preenchido ao fechar a sessão. NULL = sessão ativa.';

COMMIT;
