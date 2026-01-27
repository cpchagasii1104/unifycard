-- backend/migrations/247_create_chat_blocks.sql
-- SPRINT 95: LOCAL CHAT (OPT-IN) + PRESENÇA AO VIVO + ANTI-ABUSO

-- ============================================================
-- TABELA: chat_blocks
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    blocker_contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    blocked_contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    context_type presence_context_type NOT NULL,
    context_id UUID NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT chat_blocks_unique_block UNIQUE (tenant_id, blocker_contact_id, blocked_contact_id, context_type, context_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_chat_blocks_tenant_blocker ON chat_blocks(tenant_id, blocker_contact_id);
CREATE INDEX IF NOT EXISTS idx_chat_blocks_tenant_blocked ON chat_blocks(tenant_id, blocked_contact_id);
CREATE INDEX IF NOT EXISTS idx_chat_blocks_tenant_context ON chat_blocks(tenant_id, context_type, context_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE chat_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_blocks_tenant_isolation ON chat_blocks FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);





