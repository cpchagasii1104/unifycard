-- Migration: event_attendees
-- Forward-only, sem DROP

CREATE TABLE IF NOT EXISTS event_attendees (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id),
  event_id          UUID        NOT NULL REFERENCES events(id),
  global_user_id    UUID        REFERENCES global_users(global_user_id),
  actor_id          UUID        REFERENCES actors(id),
  check_in_time     TIMESTAMPTZ,
  status            TEXT        NOT NULL DEFAULT 'registered',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, event_id, global_user_id)
);
