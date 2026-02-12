-- backend/migrations/244_create_live_presence.sql
-- SPRINT 95: LOCAL CHAT (OPT-IN) + PRESENÇA AO VIVO + ANTI-ABUSO

-- ============================================================
-- ENUM: live_presence_status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'live_presence_status') THEN
    CREATE TYPE live_presence_status AS ENUM (
      'ONLINE',
      'OFFLINE'
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: live_presence
-- ============================================================
CREATE TABLE IF NOT EXISTS live_presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    context_type presence_context_type NOT NULL,
    context_id UUID NOT NULL,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    status live_presence_status NOT NULL DEFAULT 'OFFLINE',
    opted_in BOOLEAN NOT NULL DEFAULT false,
    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT live_presence_unique_context_contact UNIQUE (tenant_id, context_type, context_id, contact_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_live_presence_tenant_context_status ON live_presence(tenant_id, context_type, context_id, status);
CREATE INDEX IF NOT EXISTS idx_live_presence_expires_at ON live_presence(expires_at);
CREATE INDEX IF NOT EXISTS idx_live_presence_tenant_context_opted ON live_presence(tenant_id, context_type, context_id, opted_in) WHERE opted_in = true AND status = 'ONLINE';

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE live_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY live_presence_tenant_isolation ON live_presence FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_live_presence_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_update_live_presence_updated_at BEFORE UPDATE ON live_presence FOR EACH ROW EXECUTE FUNCTION update_live_presence_updated_at();





