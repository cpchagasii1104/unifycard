-- ================================================
-- UNIFICARD - MIGRATION 033
-- CARE (Chat Auto-Responder Engine) Module
-- Motor de resposta autônoma para conversas inteligentes
-- ================================================

-- ===========================
-- CARE SESSIONS
-- ===========================
CREATE TABLE IF NOT EXISTS care_sessions (
  care_session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  target_global_user_id UUID REFERENCES global_users(global_user_id) ON DELETE SET NULL,
  target_company_id UUID,
  last_message TEXT,
  state JSONB DEFAULT '{}'::jsonb,
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_care_sessions_tenant ON care_sessions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_care_sessions_user ON care_sessions (global_user_id);
CREATE INDEX IF NOT EXISTS idx_care_sessions_target_user ON care_sessions (target_global_user_id) WHERE target_global_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_care_sessions_target_company ON care_sessions (target_company_id) WHERE target_company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_care_sessions_updated_at ON care_sessions (updated_at DESC);

-- RLS
ALTER TABLE care_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY care_sessions_rls ON care_sessions
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ===========================
-- CARE MESSAGES
-- ===========================
CREATE TABLE IF NOT EXISTS care_messages (
  message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_session_id UUID NOT NULL REFERENCES care_sessions(care_session_id) ON DELETE CASCADE,
  is_from_user BOOLEAN NOT NULL,
  content TEXT NOT NULL,
  intent TEXT,
  parameters JSONB,
  ai_reasoning JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_care_messages_session ON care_messages (care_session_id);
CREATE INDEX IF NOT EXISTS idx_care_messages_created_at ON care_messages (care_session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_care_messages_intent ON care_messages (intent) WHERE intent IS NOT NULL;

-- RLS (herda do session)
ALTER TABLE care_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY care_messages_rls ON care_messages
  USING (
    EXISTS (
      SELECT 1 FROM care_sessions
      WHERE care_sessions.care_session_id = care_messages.care_session_id
      AND care_sessions.tenant_id::text = current_setting('app.current_tenant', true)
    )
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_care_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_care_sessions_updated_at
  BEFORE UPDATE ON care_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_care_sessions_updated_at();

-- ===========================
-- COMENTÁRIOS
-- ===========================
COMMENT ON TABLE care_sessions IS 'Sessões de conversa do motor de resposta autônoma';
COMMENT ON COLUMN care_sessions.global_user_id IS 'Usuário consumidor da conversa';
COMMENT ON COLUMN care_sessions.target_global_user_id IS 'Profissional alvo (opcional)';
COMMENT ON COLUMN care_sessions.target_company_id IS 'Empresa alvo (opcional)';
COMMENT ON COLUMN care_sessions.state IS 'Estado da conversa (perguntas pendentes, dados faltantes)';
COMMENT ON COLUMN care_sessions.context IS 'Contexto incremental da conversa (intents, categorias, parâmetros)';
COMMENT ON TABLE care_messages IS 'Mensagens da conversa (usuário e sistema)';
COMMENT ON COLUMN care_messages.is_from_user IS 'true = mensagem do usuário, false = mensagem do sistema';
COMMENT ON COLUMN care_messages.ai_reasoning IS 'Raciocínio do AI Kernel para gerar a resposta';








