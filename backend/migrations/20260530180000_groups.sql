-- Migration: groups
-- Forward-only, sem DROP

CREATE TABLE IF NOT EXISTS groups (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id),
  name            TEXT        NOT NULL,
  description     TEXT,
  slug            TEXT,
  actor_id        UUID        REFERENCES actors(id),
  owner_actor_id  UUID        REFERENCES actors(id),
  status          TEXT        NOT NULL DEFAULT 'active',
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, slug)
);
