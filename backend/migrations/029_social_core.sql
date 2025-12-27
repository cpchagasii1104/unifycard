-- ================================================
-- UNIFICARD - MIGRATION 029
-- Social Core Module
-- Sistema de posts sociais com detecção de intent e categorização
-- ================================================

-- ===========================
-- POSTS
-- ===========================
CREATE TABLE IF NOT EXISTS posts (
  post_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media JSONB DEFAULT '[]'::jsonb,
  intent TEXT,
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  categories TEXT[] DEFAULT ARRAY[]::TEXT[],
  suggested_actions JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_posts_tenant ON posts (tenant_id);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts (global_user_id);
CREATE INDEX IF NOT EXISTS idx_posts_intent ON posts (intent) WHERE intent IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_categories ON posts USING GIN (categories);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at DESC);

-- RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY posts_rls ON posts
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_posts_updated_at();

-- ===========================
-- COMENTÁRIOS
-- ===========================
COMMENT ON TABLE posts IS 'Posts sociais do sistema com detecção automática de intent e categorização';
COMMENT ON COLUMN posts.content IS 'Conteúdo textual do post';
COMMENT ON COLUMN posts.media IS 'Array JSON com URLs de imagens, vídeos e áudios';
COMMENT ON COLUMN posts.intent IS 'Intent detectada automaticamente pelo orchestrator';
COMMENT ON COLUMN posts.confidence IS 'Confiança da detecção de intent (0 a 1)';
COMMENT ON COLUMN posts.categories IS 'Array de IDs de categorias detectadas automaticamente';
COMMENT ON COLUMN posts.suggested_actions IS 'Ações sugeridas pelo orchestrator baseadas no post';
COMMENT ON COLUMN posts.metadata IS 'Metadados adicionais do post';








