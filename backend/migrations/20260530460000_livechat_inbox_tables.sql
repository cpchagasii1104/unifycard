BEGIN;

CREATE TABLE IF NOT EXISTS chat_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  blocker_contact_id UUID NOT NULL REFERENCES actors(id),
  blocked_contact_id UUID NOT NULL REFERENCES actors(id),
  context_type TEXT,
  context_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_chat_block UNIQUE (
    tenant_id,
    blocker_contact_id,
    blocked_contact_id,
    context_type,
    context_id
  )
);
CREATE INDEX IF NOT EXISTS idx_chat_blocks_blocker ON chat_blocks(blocker_contact_id);
CREATE INDEX IF NOT EXISTS idx_chat_blocks_blocked ON chat_blocks(blocked_contact_id);

CREATE TABLE IF NOT EXISTS chat_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  reporter_contact_id UUID NOT NULL REFERENCES actors(id),
  reported_contact_id UUID NOT NULL REFERENCES actors(id),
  room_id UUID REFERENCES chat_rooms(id),
  message_id UUID REFERENCES chat_messages(id),
  reason_code TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','ACK','RESOLVED')),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_reports_reporter ON chat_reports(reporter_contact_id);
CREATE INDEX IF NOT EXISTS idx_chat_reports_reported ON chat_reports(reported_contact_id);

CREATE TABLE IF NOT EXISTS live_presence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  context_type TEXT NOT NULL,
  context_id UUID NOT NULL,
  contact_id UUID NOT NULL REFERENCES actors(id),
  status TEXT NOT NULL DEFAULT 'ONLINE'
    CHECK (status IN ('ONLINE','OFFLINE')),
  opted_in BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_live_presence UNIQUE (tenant_id, context_type, context_id, contact_id)
);
CREATE INDEX IF NOT EXISTS idx_live_presence_context ON live_presence(context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_live_presence_contact ON live_presence(contact_id);

CREATE TABLE IF NOT EXISTS social_inbox_items (
  inbox_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID NOT NULL REFERENCES actors(id),
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread'
    CHECK (status IN ('unread','read','archived')),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  CONSTRAINT uq_social_inbox_item UNIQUE (actor_id, source_type, source_id)
);
CREATE INDEX IF NOT EXISTS idx_social_inbox_actor ON social_inbox_items(actor_id);
CREATE INDEX IF NOT EXISTS idx_social_inbox_source ON social_inbox_items(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_social_inbox_unread ON social_inbox_items(actor_id, status)
  WHERE status = 'unread';

COMMIT;