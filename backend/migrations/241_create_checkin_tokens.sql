-- backend/migrations/241_create_checkin_tokens.sql
-- SPRINT 94: PRESENÇA + CHECK-IN SOCIAL + BENEFÍCIOS PROMOCIONAIS

-- ============================================================
-- ENUM: checkin_token_status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'checkin_token_status') THEN
    CREATE TYPE checkin_token_status AS ENUM (
      'ACTIVE',
      'REVOKED',
      'EXPIRED'
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: checkin_tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS checkin_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    context_type presence_context_type NOT NULL,
    context_id UUID NOT NULL,
    token TEXT NOT NULL UNIQUE,
    status checkin_token_status NOT NULL DEFAULT 'ACTIVE',
    valid_from TIMESTAMP WITH TIME ZONE,
    valid_to TIMESTAMP WITH TIME ZONE,
    created_by_actor_id UUID REFERENCES actors(actor_id) ON DELETE SET NULL,
    created_by_user_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_checkin_tokens_tenant_context ON checkin_tokens(tenant_id, context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_checkin_tokens_token ON checkin_tokens(token);
CREATE INDEX IF NOT EXISTS idx_checkin_tokens_tenant_status ON checkin_tokens(tenant_id, status) WHERE status = 'ACTIVE';

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE checkin_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY checkin_tokens_tenant_isolation ON checkin_tokens FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);





