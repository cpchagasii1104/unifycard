-- Migration: group_members
-- Forward-only, sem DROP
-- Depende de: groups (20260530180000)

CREATE TABLE IF NOT EXISTS group_members (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id),
  group_id    UUID        NOT NULL REFERENCES groups(id),
  user_id     UUID        NOT NULL REFERENCES users(user_id),
  role        TEXT        NOT NULL DEFAULT 'member',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, group_id, user_id)
);
