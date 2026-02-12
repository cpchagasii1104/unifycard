-- backend/migrations/257_create_system_notifications.sql
-- Sistema de Notificações In-App Explícitas
-- 🔴 BLINDAGEM: NÃO executa ações automaticamente
-- 🔴 BLINDAGEM: NÃO marca como lida automaticamente
-- 🔴 BLINDAGEM: Usuário decide o que fazer

-- ============================================================
-- ENUM: system_notification_type
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'system_notification_type') THEN
    CREATE TYPE system_notification_type AS ENUM (
      'rfq_created',
      'quote_received',
      'booking_requested',
      'booking_accepted',
      'booking_rejected',
      'message_received',
      'service_order_confirmed',
      'service_order_completed'
    );
  END IF;
END$$;

-- ============================================================
-- ENUM: system_notification_context_type
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'system_notification_context_type') THEN
    CREATE TYPE system_notification_context_type AS ENUM (
      'event',
      'rfq',
      'booking',
      'service_order'
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: system_notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS system_notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  recipient_actor_id UUID NOT NULL, -- Actor que recebe a notificação
  type system_notification_type NOT NULL,
  context_type system_notification_context_type NOT NULL,
  context_id UUID NOT NULL, -- eventId, rfqId, bookingId, serviceOrderId
  message TEXT NOT NULL, -- Mensagem human-readable
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- Dados adicionais
  read_at TIMESTAMP WITH TIME ZONE, -- null = não lida
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraint: mensagem não pode ser vazia
  CONSTRAINT system_notifications_message_not_empty CHECK (length(trim(message)) > 0)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_system_notifications_tenant_recipient 
  ON system_notifications(tenant_id, recipient_actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_notifications_tenant_recipient_unread 
  ON system_notifications(tenant_id, recipient_actor_id, read_at)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_system_notifications_context 
  ON system_notifications(tenant_id, context_type, context_id);

CREATE INDEX IF NOT EXISTS idx_system_notifications_type 
  ON system_notifications(tenant_id, type, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE system_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_notifications_tenant_isolation 
  ON system_notifications FOR ALL 
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);




