-- backend/migrations/246_create_chat_messages.sql
-- SPRINT 95: LOCAL CHAT (OPT-IN) + PRESENÇA AO VIVO + ANTI-ABUSO

-- ============================================================
-- ENUM: chat_message_status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_message_status') THEN
    CREATE TYPE chat_message_status AS ENUM (
      'VISIBLE',
      'DELETED'
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: chat_messages (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status chat_message_status NOT NULL DEFAULT 'VISIBLE',
    client_message_id TEXT, -- idempotência do cliente
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Idempotência: evitar duplicar mensagem do cliente (índice único parcial)
CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_idempotency 
    ON chat_messages (tenant_id, room_id, contact_id, client_message_id) 
    WHERE client_message_id IS NOT NULL;

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant_room_created ON chat_messages(tenant_id, room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant_room_status ON chat_messages(tenant_id, room_id, status) WHERE status = 'VISIBLE';
CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant_contact ON chat_messages(tenant_id, contact_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_messages_tenant_isolation ON chat_messages FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);





