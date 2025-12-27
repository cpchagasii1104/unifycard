-- ================================================
-- UNIFICARD - MIGRATION 031
-- Social Chat Intelligence (SCI) Module
-- Sistema de chat inteligente com detecção automática de intent e ações
-- ================================================

-- ===========================
-- SOCIAL CHAT MESSAGES
-- ===========================
CREATE TABLE IF NOT EXISTS social_chat_messages (
  message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  raw_content TEXT, -- Conteúdo original antes de processamento (ex: transcrição de áudio)
  media JSONB DEFAULT '[]'::jsonb,
  intent TEXT,
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  categories TEXT[] DEFAULT ARRAY[]::TEXT[],
  suggested_actions JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_social_chat_messages_conversation ON social_chat_messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_social_chat_messages_tenant ON social_chat_messages (tenant_id);
CREATE INDEX IF NOT EXISTS idx_social_chat_messages_user ON social_chat_messages (global_user_id);
CREATE INDEX IF NOT EXISTS idx_social_chat_messages_intent ON social_chat_messages (intent) WHERE intent IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_chat_messages_categories ON social_chat_messages USING GIN (categories);
CREATE INDEX IF NOT EXISTS idx_social_chat_messages_created_at ON social_chat_messages (conversation_id, created_at DESC);

-- RLS
ALTER TABLE social_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY social_chat_messages_rls ON social_chat_messages
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ===========================
-- COMENTÁRIOS
-- ===========================
COMMENT ON TABLE social_chat_messages IS 'Mensagens de chat inteligente com detecção automática de intent e categorização';
COMMENT ON COLUMN social_chat_messages.conversation_id IS 'ID da conversa (pode ser UUID gerado ou ID customizado)';
COMMENT ON COLUMN social_chat_messages.content IS 'Conteúdo processado da mensagem';
COMMENT ON COLUMN social_chat_messages.raw_content IS 'Conteúdo original (ex: transcrição de áudio)';
COMMENT ON COLUMN social_chat_messages.intent IS 'Intent detectada automaticamente pelo orchestrator';
COMMENT ON COLUMN social_chat_messages.confidence IS 'Confiança da detecção de intent (0 a 1)';
COMMENT ON COLUMN social_chat_messages.categories IS 'Array de IDs de categorias detectadas automaticamente';
COMMENT ON COLUMN social_chat_messages.suggested_actions IS 'Ações sugeridas pelo orchestrator baseadas na mensagem';








