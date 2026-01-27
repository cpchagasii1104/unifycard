-- backend/migrations/240_create_presence_rsvps.sql
-- SPRINT 94: PRESENÇA + CHECK-IN SOCIAL + BENEFÍCIOS PROMOCIONAIS

-- ============================================================
-- ENUM: presence_context_type
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'presence_context_type') THEN
    CREATE TYPE presence_context_type AS ENUM (
      'EVENT',
      'VENUE'
    );
  END IF;
END$$;

-- ============================================================
-- ENUM: presence_rsvp_status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'presence_rsvp_status') THEN
    CREATE TYPE presence_rsvp_status AS ENUM (
      'CONFIRMED',
      'CANCELLED',
      'ATTENDED',
      'NO_SHOW'
    );
  END IF;
END$$;

-- ============================================================
-- ENUM: presence_visibility
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'presence_visibility') THEN
    CREATE TYPE presence_visibility AS ENUM (
      'PRIVATE',
      'PUBLIC'
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: presence_rsvps
-- ============================================================
CREATE TABLE IF NOT EXISTS presence_rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    context_type presence_context_type NOT NULL,
    context_id UUID NOT NULL,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    status presence_rsvp_status NOT NULL DEFAULT 'CONFIRMED',
    visibility presence_visibility NOT NULL DEFAULT 'PRIVATE',
    confirmed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    attended_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT presence_rsvps_unique_context_contact UNIQUE (tenant_id, context_type, context_id, contact_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_presence_rsvps_tenant_context_status ON presence_rsvps(tenant_id, context_type, context_id, status);
CREATE INDEX IF NOT EXISTS idx_presence_rsvps_tenant_contact ON presence_rsvps(tenant_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_presence_rsvps_tenant_context_public ON presence_rsvps(tenant_id, context_type, context_id, visibility) WHERE visibility = 'PUBLIC';

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE presence_rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY presence_rsvps_tenant_isolation ON presence_rsvps FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_presence_rsvps_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_update_presence_rsvps_updated_at BEFORE UPDATE ON presence_rsvps FOR EACH ROW EXECUTE FUNCTION update_presence_rsvps_updated_at();





