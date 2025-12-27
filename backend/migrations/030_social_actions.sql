-- ================================================
-- UNIFICARD - MIGRATION 030
-- Social Actions Module
-- Sistema de ações executáveis a partir de posts sociais
-- ================================================

-- ===========================
-- SOCIAL ACTIONS
-- ===========================
CREATE TABLE IF NOT EXISTS social_actions (
  action_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  intent TEXT NOT NULL,
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  parameters JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'executed', 'failed', 'cancelled')),
  execution_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_at TIMESTAMPTZ
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_social_actions_post ON social_actions (post_id);
CREATE INDEX IF NOT EXISTS idx_social_actions_tenant ON social_actions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_social_actions_user ON social_actions (global_user_id);
CREATE INDEX IF NOT EXISTS idx_social_actions_intent ON social_actions (intent);
CREATE INDEX IF NOT EXISTS idx_social_actions_status ON social_actions (status);
CREATE INDEX IF NOT EXISTS idx_social_actions_created_at ON social_actions (created_at DESC);

-- RLS
ALTER TABLE social_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY social_actions_rls ON social_actions
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ===========================
-- COMENTÁRIOS
-- ===========================
COMMENT ON TABLE social_actions IS 'Ações executáveis geradas automaticamente a partir de posts sociais';
COMMENT ON COLUMN social_actions.post_id IS 'Post que gerou esta ação';
COMMENT ON COLUMN social_actions.intent IS 'Intent detectada no post';
COMMENT ON COLUMN social_actions.confidence IS 'Confiança da detecção de intent';
COMMENT ON COLUMN social_actions.parameters IS 'Parâmetros extraídos do post para execução';
COMMENT ON COLUMN social_actions.status IS 'Status da ação: available, executed, failed, cancelled';
COMMENT ON COLUMN social_actions.execution_result IS 'Resultado da execução da ação';








