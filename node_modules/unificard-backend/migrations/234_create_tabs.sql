-- backend/migrations/234_create_tabs.sql
-- SPRINT 92: MENU + COMANDA (TAB) + QR ORDERING

-- ============================================================
-- ENUM: tab_status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tab_status') THEN
    CREATE TYPE tab_status AS ENUM (
      'OPEN',
      'CLOSED',
      'CANCELLED'
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: tabs
-- ============================================================
CREATE TABLE IF NOT EXISTS tabs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES actors(actor_id) ON DELETE CASCADE,
    opened_by_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    opened_by_user_id UUID, -- Opcional, se usuário logado
    status tab_status NOT NULL DEFAULT 'OPEN',
    table_label TEXT, -- Ex: "Mesa 7"
    qr_token TEXT NOT NULL UNIQUE, -- Token aleatório, não adivinhável
    opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tabs_tenant_actor_status ON tabs(tenant_id, actor_id, status);
CREATE INDEX IF NOT EXISTS idx_tabs_tenant_qr_token ON tabs(tenant_id, qr_token);
CREATE INDEX IF NOT EXISTS idx_tabs_tenant_contact ON tabs(tenant_id, opened_by_contact_id) WHERE opened_by_contact_id IS NOT NULL;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE tabs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tabs_tenant_isolation ON tabs FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_tabs_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_update_tabs_updated_at BEFORE UPDATE ON tabs FOR EACH ROW EXECUTE FUNCTION update_tabs_updated_at();





