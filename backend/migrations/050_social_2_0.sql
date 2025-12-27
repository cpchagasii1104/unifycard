-- ================================================
-- UNIFICARD - MIGRATION 050
-- Social 2.0 - Sistema de rede social completo
-- Actor-based architecture (User/Page/Group/Channel)
-- ================================================

-- ===========================
-- ACTORS (unifica User/Page/Group/Channel)
-- ===========================
CREATE TABLE IF NOT EXISTS actors (
  actor_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('user', 'page', 'group', 'channel')),
  
  -- Referência ao tipo específico
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(company_id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(group_id) ON DELETE CASCADE,
  -- channel_id pode ser adicionado no futuro
  
  -- Dados do actor
  display_name TEXT NOT NULL,
  slug VARCHAR(255), -- URL-friendly identifier
  avatar_url TEXT,
  cover_url TEXT, -- Imagem de capa
  bio TEXT, -- Biografia/descrição
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT actors_type_reference CHECK (
    (actor_type = 'user' AND user_id IS NOT NULL AND company_id IS NULL AND group_id IS NULL) OR
    (actor_type = 'page' AND company_id IS NOT NULL AND user_id IS NULL AND group_id IS NULL) OR
    (actor_type = 'group' AND group_id IS NOT NULL AND user_id IS NULL AND company_id IS NULL) OR
    (actor_type = 'channel' AND user_id IS NULL AND company_id IS NULL AND group_id IS NULL)
  )
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_actors_tenant ON actors (tenant_id);
CREATE INDEX IF NOT EXISTS idx_actors_type ON actors (actor_type);
CREATE INDEX IF NOT EXISTS idx_actors_user ON actors (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_actors_company ON actors (company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_actors_group ON actors (group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_actors_slug ON actors (tenant_id, slug) WHERE slug IS NOT NULL;

-- RLS
ALTER TABLE actors ENABLE ROW LEVEL SECURITY;
CREATE POLICY actors_rls ON actors
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ===========================
-- POST_MEDIA (mídia separada dos posts)
-- ===========================
CREATE TABLE IF NOT EXISTS post_media (
  media_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
  
  -- Tipo e URL
  media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('image', 'video', 'audio', 'document')),
  url TEXT NOT NULL,
  thumbnail_url TEXT, -- Para vídeos
  file_size BIGINT, -- Tamanho em bytes
  mime_type VARCHAR(100),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Ordem de exibição
  display_order INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_post_media_post ON post_media (post_id);
CREATE INDEX IF NOT EXISTS idx_post_media_tenant ON post_media (tenant_id);
CREATE INDEX IF NOT EXISTS idx_post_media_type ON post_media (media_type);

-- RLS
ALTER TABLE post_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY post_media_rls ON post_media
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ===========================
-- REACTIONS (reações aos posts)
-- ===========================
CREATE TABLE IF NOT EXISTS reactions (
  reaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  
  -- Tipo de reação
  reaction_type VARCHAR(20) NOT NULL DEFAULT 'like' CHECK (reaction_type IN ('like', 'love', 'haha', 'wow', 'sad', 'angry')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Um usuário só pode ter uma reação por post (pode mudar o tipo)
  CONSTRAINT reactions_unique_user_post UNIQUE (post_id, global_user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_reactions_post ON reactions (post_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON reactions (global_user_id);
CREATE INDEX IF NOT EXISTS idx_reactions_tenant ON reactions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_reactions_type ON reactions (reaction_type);

-- RLS
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY reactions_rls ON reactions
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ===========================
-- COMMENTS (comentários nos posts)
-- ===========================
CREATE TABLE IF NOT EXISTS comments (
  comment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  
  -- Conteúdo
  content TEXT NOT NULL,
  
  -- Resposta a outro comentário (threading)
  parent_comment_id UUID REFERENCES comments(comment_id) ON DELETE CASCADE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ, -- Soft delete
  is_deleted BOOLEAN DEFAULT false
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments (post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments (global_user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments (parent_comment_id) WHERE parent_comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_tenant ON comments (tenant_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments (created_at DESC);

-- RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY comments_rls ON comments
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ===========================
-- ATUALIZAR POSTS para usar actor_id
-- ===========================
-- Adicionar coluna actor_id (mantém global_user_id para compatibilidade)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES actors(actor_id) ON DELETE CASCADE;

-- Índice para actor_id
CREATE INDEX IF NOT EXISTS idx_posts_actor ON posts (actor_id) WHERE actor_id IS NOT NULL;

-- ===========================
-- ADICIONAR COVER em profiles e companies
-- ===========================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- ===========================
-- TRIGGERS
-- ===========================
-- Trigger para atualizar updated_at em actors
CREATE OR REPLACE FUNCTION update_actors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_actors_updated_at
  BEFORE UPDATE ON actors
  FOR EACH ROW
  EXECUTE FUNCTION update_actors_updated_at();

-- Trigger para atualizar updated_at em reactions
CREATE OR REPLACE FUNCTION update_reactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reactions_updated_at
  BEFORE UPDATE ON reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_reactions_updated_at();

-- Trigger para atualizar updated_at em comments
CREATE OR REPLACE FUNCTION update_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_comments_updated_at();

-- ===========================
-- COMMENTS
-- ===========================
COMMENT ON TABLE actors IS 'Sistema unificado de actors (User/Page/Group/Channel) para autoria de posts';
COMMENT ON TABLE post_media IS 'Mídia associada aos posts (imagens, vídeos, etc.)';
COMMENT ON TABLE reactions IS 'Reações dos usuários aos posts';
COMMENT ON TABLE comments IS 'Comentários nos posts com suporte a threading';
