-- Migration: schedules
-- Forward-only, sem DROP

CREATE TABLE IF NOT EXISTS schedules (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id),
  actor_id        UUID        REFERENCES actors(id),
  reference_type  TEXT,
  reference_id    UUID,
  status          TEXT        NOT NULL DEFAULT 'active',
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
