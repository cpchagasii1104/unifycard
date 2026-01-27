-- backend/migrations/256_create_contextual_threads.sql
-- Mensageria Contextual vinculada a Evento, RFQ, Booking e Service Order
-- 🔴 BLINDAGEM: NÃO toma decisões automáticas
-- 🔴 BLINDAGEM: NÃO muda status automaticamente

-- ============================================================
-- ENUM: contextual_thread_type
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contextual_thread_type') THEN
    CREATE TYPE contextual_thread_type AS ENUM (
      'event',
      'rfq',
      'booking',
      'service_order'
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: contextual_threads
-- ============================================================
CREATE TABLE IF NOT EXISTS contextual_threads (
  thread_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  context_type contextual_thread_type NOT NULL,
  context_id UUID NOT NULL, -- eventId, rfqId, bookingId, ou serviceOrderId
  title TEXT,
  participant_actor_ids UUID[] NOT NULL DEFAULT '{}', -- Array de actor_ids participantes
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  -- Constraint: uma thread por contexto (opcional, pode ter múltiplas threads por contexto)
  -- Removido para permitir múltiplas threads por contexto se necessário
);

-- ============================================================
-- TABELA: contextual_messages
-- ============================================================
CREATE TABLE IF NOT EXISTS contextual_messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES contextual_threads(thread_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  sender_actor_id UUID NOT NULL, -- Actor que enviou
  sender_user_id UUID, -- User que enviou (opcional, para auditoria)
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Constraint: conteúdo não pode ser vazio
  CONSTRAINT contextual_messages_content_not_empty CHECK (length(trim(content)) > 0)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_contextual_threads_tenant_context 
  ON contextual_threads(tenant_id, context_type, context_id);

CREATE INDEX IF NOT EXISTS idx_contextual_threads_participants 
  ON contextual_threads USING GIN(participant_actor_ids);

CREATE INDEX IF NOT EXISTS idx_contextual_threads_updated 
  ON contextual_threads(tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_contextual_messages_thread 
  ON contextual_messages(thread_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_contextual_messages_tenant 
  ON contextual_messages(tenant_id);

CREATE INDEX IF NOT EXISTS idx_contextual_messages_sender 
  ON contextual_messages(sender_actor_id);

-- ============================================================
-- TRIGGER: atualizar updated_at da thread ao criar mensagem
-- ============================================================
CREATE OR REPLACE FUNCTION update_contextual_thread_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE contextual_threads
  SET updated_at = NOW()
  WHERE thread_id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_contextual_thread_updated_at
  AFTER INSERT ON contextual_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_contextual_thread_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE contextual_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE contextual_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY contextual_threads_tenant_isolation 
  ON contextual_threads FOR ALL 
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY contextual_messages_tenant_isolation 
  ON contextual_messages FOR ALL 
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);




