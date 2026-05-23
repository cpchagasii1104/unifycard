-- Migration: event_organizers
-- Forward-only, sem DROP

CREATE TABLE IF NOT EXISTS event_organizers (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID        NOT NULL REFERENCES tenants(id),
  name                  TEXT        NOT NULL,
  description           TEXT,
  logo_url              TEXT,
  actor_id              UUID        REFERENCES actors(id),
  owner_global_user_id  UUID        REFERENCES global_users(global_user_id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
