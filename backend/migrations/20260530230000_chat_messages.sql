-- Migration: chat_messages
-- Forward-only, sem DROP
-- Depende de: chat_rooms (20260530220000)

CREATE TABLE IF NOT EXISTS chat_messages (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id),
  room_id           UUID        NOT NULL REFERENCES chat_rooms(id),
  actor_id          UUID        REFERENCES actors(id),
  contact_id        UUID,
  content           TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'sent',
  client_message_id TEXT,
  metadata          JSONB       NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN chat_messages.contact_id IS
  'Referência livre — resolver FK quando módulo live-chat for auditado';
