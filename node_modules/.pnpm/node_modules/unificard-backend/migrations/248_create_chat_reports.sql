-- backend/migrations/248_create_chat_reports.sql
-- SPRINT 95: LOCAL CHAT (OPT-IN) + PRESENÇA AO VIVO + ANTI-ABUSO

-- ============================================================
-- ENUM: chat_report_reason
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_report_reason') THEN
    CREATE TYPE chat_report_reason AS ENUM (
      'SPAM',
      'HARASSMENT',
      'HATE',
      'SEXUAL',
      'OTHER'
    );
  END IF;
END$$;

-- ============================================================
-- ENUM: chat_report_status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_report_status') THEN
    CREATE TYPE chat_report_status AS ENUM (
      'OPEN',
      'ACK',
      'RESOLVED'
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: chat_reports (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    reporter_contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    reported_contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
    reason_code chat_report_reason NOT NULL,
    details TEXT,
    status chat_report_status NOT NULL DEFAULT 'OPEN',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_chat_reports_tenant_status_created ON chat_reports(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_reports_tenant_room ON chat_reports(tenant_id, room_id);
CREATE INDEX IF NOT EXISTS idx_chat_reports_tenant_reported ON chat_reports(tenant_id, reported_contact_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE chat_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_reports_tenant_isolation ON chat_reports FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_chat_reports_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_update_chat_reports_updated_at BEFORE UPDATE ON chat_reports FOR EACH ROW EXECUTE FUNCTION update_chat_reports_updated_at();





