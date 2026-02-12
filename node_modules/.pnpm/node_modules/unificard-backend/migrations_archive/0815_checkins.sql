-- backend/migrations/242_create_checkins.sql
-- SPRINT 94: PRESENÇA + CHECK-IN SOCIAL + BENEFÍCIOS PROMOCIONAIS

-- ============================================================
-- ENUM: checkin_type
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'checkin_type') THEN
    CREATE TYPE checkin_type AS ENUM (
      'QR',
      'MANUAL'
    );
  END IF;
END$$;

-- ============================================================
-- ENUM: checkin_status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'checkin_status') THEN
    CREATE TYPE checkin_status AS ENUM (
      'CHECKED_IN',
      'CHECKED_OUT'
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: checkins (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    context_type presence_context_type NOT NULL,
    context_id UUID NOT NULL,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    token_id UUID REFERENCES checkin_tokens(id) ON DELETE SET NULL,
    checkin_type checkin_type NOT NULL,
    status checkin_status NOT NULL,
    reference_event_id TEXT, -- idempotência opcional (device event id)
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Idempotência: evitar duplicar check-in (índices únicos parciais)
CREATE UNIQUE INDEX IF NOT EXISTS checkins_idempotency_checkin 
    ON checkins (tenant_id, context_type, context_id, contact_id, status) 
    WHERE status = 'CHECKED_IN';
    
CREATE UNIQUE INDEX IF NOT EXISTS checkins_idempotency_reference 
    ON checkins (tenant_id, reference_event_id) 
    WHERE reference_event_id IS NOT NULL;

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_checkins_tenant_context_created ON checkins(tenant_id, context_type, context_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkins_tenant_contact ON checkins(tenant_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_checkins_tenant_token ON checkins(tenant_id, token_id) WHERE token_id IS NOT NULL;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY checkins_tenant_isolation ON checkins FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);





