-- Migration: chat_rooms
-- Forward-only, sem DROP

CREATE TABLE IF NOT EXISTS chat_rooms (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id),
  name        TEXT,
  room_type   TEXT        NOT NULL DEFAULT 'direct',
  status      TEXT        NOT NULL DEFAULT 'active',
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
