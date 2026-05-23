BEGIN;

CREATE TABLE IF NOT EXISTS event_specs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  spec_id UUID NOT NULL UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID NOT NULL REFERENCES actors(id),
  actor_type TEXT NOT NULL,
  event_id UUID REFERENCES events(id),
  spec_version INTEGER NOT NULL DEFAULT 1,
  macro_intention TEXT,
  subflow TEXT,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
