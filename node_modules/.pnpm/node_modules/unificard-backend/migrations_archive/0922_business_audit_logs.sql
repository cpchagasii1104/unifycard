-- backend/migrations/258_create_business_audit_logs.sql
-- Sistema de Auditoria e Histórico de Decisões de Negócio
-- 🔴 BLINDAGEM: Logs são IMUTÁVEIS (append-only)
-- 🔴 BLINDAGEM: Logs NÃO mudam estado
-- 🔴 BLINDAGEM: Logs NÃO disparam ações

-- ============================================================
-- ENUM: business_audit_action
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'business_audit_action') THEN
    CREATE TYPE business_audit_action AS ENUM (
      'booking_requested',
      'booking_decided',
      'booking_confirmed',
      'rfq_created',
      'quote_submitted',
      'rfq_converted',
      'bundle_confirmed',
      'financial_terms_confirmed',
      'service_order_created',
      'service_order_confirmed',
      'service_order_started',
      'service_order_completed',
      'service_order_cancelled',
      'permission_denied'
    );
  END IF;
END$$;

-- ============================================================
-- ENUM: business_audit_context_type
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'business_audit_context_type') THEN
    CREATE TYPE business_audit_context_type AS ENUM (
      'event',
      'rfq',
      'booking',
      'service_order',
      'bundle',
      'split'
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: business_audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS business_audit_logs (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  action business_audit_action NOT NULL,
  actor_id UUID NOT NULL, -- Actor que executou a ação
  user_id UUID, -- User que executou (opcional, para auditoria)
  context_type business_audit_context_type NOT NULL,
  context_id UUID NOT NULL, -- eventId, rfqId, bookingId, serviceOrderId, etc
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- Dados adicionais da ação
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraint: não pode ter campos NULL críticos
  CONSTRAINT business_audit_logs_actor_required CHECK (actor_id IS NOT NULL),
  CONSTRAINT business_audit_logs_context_required CHECK (context_id IS NOT NULL)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_business_audit_logs_tenant_context 
  ON business_audit_logs(tenant_id, context_type, context_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_audit_logs_tenant_actor 
  ON business_audit_logs(tenant_id, actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_audit_logs_tenant_action 
  ON business_audit_logs(tenant_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_audit_logs_tenant_created 
  ON business_audit_logs(tenant_id, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE business_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY business_audit_logs_tenant_isolation 
  ON business_audit_logs FOR ALL 
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE business_audit_logs IS 'Logs imutáveis de ações de negócio para rastreabilidade legal e operacional';
COMMENT ON COLUMN business_audit_logs.log_id IS 'ID único do log (imutável)';
COMMENT ON COLUMN business_audit_logs.action IS 'Tipo de ação executada';
COMMENT ON COLUMN business_audit_logs.actor_id IS 'Actor que executou a ação';
COMMENT ON COLUMN business_audit_logs.user_id IS 'User que executou (para auditoria)';
COMMENT ON COLUMN business_audit_logs.context_type IS 'Tipo de contexto da ação';
COMMENT ON COLUMN business_audit_logs.context_id IS 'ID do contexto (eventId, rfqId, etc)';
COMMENT ON COLUMN business_audit_logs.metadata IS 'Dados adicionais da ação (imutável após criação)';
COMMENT ON COLUMN business_audit_logs.created_at IS 'Timestamp de criação (imutável)';

