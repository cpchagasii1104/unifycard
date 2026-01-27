/*
Arquivo: 029_social_core.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Módulo: Social Core

Descrição:
Módulo central de posts sociais do ecossistema UnifyCard.
Responsável por registrar conteúdo social gerado por usuários globais,
com suporte a:
- Detecção automática de intent
- Classificação semântica (categorias)
- Sugestões de ações executáveis
- Integração com AI Orchestrator, Social Actions, CARE e Memory Engine

Papel no sistema:
- Entrada primária de linguagem natural do usuário
- Fonte de dados para automações, agendas, compras, serviços e conversas
- Base histórica para reputação, memória e personalização

Dependências diretas:
- tenants
- global_users
- categories (via integração semântica, não FK direta)
- RLS baseado em tenant

Arquivos relacionados:
- 030_social_actions.sql        (ações geradas a partir de posts)
- 031_social_chat_intelligence.sql (chat inteligente)
- 033_care_module.sql           (auto-responder)
- 034_memory_engine.sql         (memória do usuário)

Observações:
- categories aqui são semânticas (TEXT[]), não FK rígida
- designed for AI-first ingestion
*/

-- =====================================================
-- POSTS
-- =====================================================

CREATE TABLE IF NOT EXISTS posts (
  post_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,

  global_user_id UUID NOT NULL
    REFERENCES global_users(global_user_id) ON DELETE CASCADE,

  content TEXT NOT NULL,

  -- Conteúdos multimídia associados ao post
  media JSONB DEFAULT '[]'::jsonb,

  -- Resultado do processamento semântico
  intent TEXT,
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),

  -- Categorias semânticas detectadas (ex: ["beleza","manicure"])
  categories TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Ações sugeridas pelo orchestrator
  suggested_actions JSONB DEFAULT '[]'::jsonb,

  -- Metadados livres (modelo, versão AI, flags experimentais)
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_posts_tenant
  ON posts (tenant_id);

CREATE INDEX IF NOT EXISTS idx_posts_user
  ON posts (global_user_id);

CREATE INDEX IF NOT EXISTS idx_posts_intent
  ON posts (intent)
  WHERE intent IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_categories
  ON posts USING GIN (categories);

CREATE INDEX IF NOT EXISTS idx_posts_created_at
  ON posts (created_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY posts_rls
  ON posts
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- =====================================================
-- TRIGGER updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_posts_updated_at ON posts;

CREATE TRIGGER trg_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_posts_updated_at();

-- =====================================================
-- COMENTÁRIOS
-- =====================================================

COMMENT ON TABLE posts IS
  'Posts sociais com processamento semântico (intent, categorias e ações sugeridas)';

COMMENT ON COLUMN posts.intent IS
  'Intent detectada automaticamente pelo AI Orchestrator';

COMMENT ON COLUMN posts.categories IS
  'Categorias semânticas detectadas (não FK rígida)';

COMMENT ON COLUMN posts.suggested_actions IS
  'Ações executáveis sugeridas a partir do conteúdo do post';

COMMENT ON COLUMN posts.metadata IS
  'Metadados técnicos e contexto do processamento AI';

-- =====================================================
-- FIM MIGRATION 029
-- =====================================================








