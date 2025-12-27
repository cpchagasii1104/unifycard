-- ============================================
-- 054_social_purpose_targeting.sql
-- Evolução Social: Posts por Propósito + Direcionamento Inteligente (Raio-X)
-- ============================================

-- Adicionar campos de intent e targeting ao post
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS intent VARCHAR(50) DEFAULT 'personal',
ADD COLUMN IF NOT EXISTS intent_metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS targeting JSONB DEFAULT '{}'::jsonb;

-- Constraint para intent válido (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'posts_intent_check'
  ) THEN
    ALTER TABLE posts
    ADD CONSTRAINT posts_intent_check CHECK (
      intent IN (
        'personal',
        'friends',
        'booking',
        'service_offer',
        'product_offer',
        'project',
        'vote',
        'event'
      )
    );
  END IF;
END $$;

-- Índices para performance no feed
CREATE INDEX IF NOT EXISTS idx_posts_intent ON posts (tenant_id, intent) WHERE intent IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_targeting ON posts USING GIN (targeting) WHERE targeting != '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_posts_intent_metadata ON posts USING GIN (intent_metadata) WHERE intent_metadata != '{}'::jsonb;

-- Tabela para votações (se post.intent = 'vote')
CREATE TABLE IF NOT EXISTS post_votes (
  vote_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES actors(actor_id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL, -- Índice da opção escolhida (0, 1, 2, ...)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, actor_id) -- Uma pessoa = um voto
);

-- RLS para post_votes
ALTER TABLE post_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY post_votes_rls ON post_votes
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Índices para votações
CREATE INDEX IF NOT EXISTS idx_post_votes_post ON post_votes (post_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_post_votes_actor ON post_votes (actor_id, tenant_id);

-- Tabela para projetos (se post.intent = 'project')
-- Nota: Projetos são posts, mas podem ter dados adicionais
CREATE TABLE IF NOT EXISTS post_projects (
  project_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  budget_cents INTEGER, -- Orçamento em centavos (opcional)
  deadline TIMESTAMPTZ, -- Prazo (opcional)
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id) -- Um post = um projeto
);

-- RLS para post_projects
ALTER TABLE post_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY post_projects_rls ON post_projects
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Índices para projetos
CREATE INDEX IF NOT EXISTS idx_post_projects_post ON post_projects (post_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_post_projects_group ON post_projects (group_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_post_projects_status ON post_projects (status, tenant_id) WHERE status = 'active';

-- Comentários
COMMENT ON COLUMN posts.intent IS 'Propósito do post: personal, friends, booking, service_offer, product_offer, project, vote, event';
COMMENT ON COLUMN posts.intent_metadata IS 'Metadados específicos do intent (categorias, preços, opções de voto, etc)';
COMMENT ON COLUMN posts.targeting IS 'Direcionamento inteligente baseado no Raio-X do CORE (demografia, lifestyle, interesses, etc)';
COMMENT ON TABLE post_votes IS 'Votos em posts com intent = vote (uma pessoa = um voto)';
COMMENT ON TABLE post_projects IS 'Projetos de grupo (posts com intent = project)';
