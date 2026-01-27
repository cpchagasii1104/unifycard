-- backend/migrations/245_create_chat_rooms.sql
-- SPRINT 95: LOCAL CHAT (OPT-IN) + PRESENÇA AO VIVO + ANTI-ABUSO

-- ============================================================
-- ENUM: chat_room_type
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_room_type') THEN
    CREATE TYPE chat_room_type AS ENUM (
      'PUBLIC'
    );
  END IF;
END$$;

-- ============================================================
-- ENUM: chat_room_status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_room_status') THEN
    CREATE TYPE chat_room_status AS ENUM (
      'ACTIVE',
      'ARCHIVED'
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: chat_rooms
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    context_type presence_context_type NOT NULL,
    context_id UUID NOT NULL,
    room_type chat_room_type NOT NULL DEFAULT 'PUBLIC',
    status chat_room_status NOT NULL DEFAULT 'ACTIVE',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT chat_rooms_unique_context_room UNIQUE (tenant_id, context_type, context_id, room_type)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_chat_rooms_tenant_context ON chat_rooms(tenant_id, context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_tenant_status ON chat_rooms(tenant_id, status) WHERE status = 'ACTIVE';

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_rooms_tenant_isolation ON chat_rooms FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);





