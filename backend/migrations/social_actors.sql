/*
Arquivo: 060_social_actors_extension.sql
Projeto: UnifiCard
Banco: PostgreSQL 14+
Escopo: Extensão social do domínio ACTORS (Social 2.0)

IMPORTANTE:
- actors JÁ EXISTE (SSOT)
- Este arquivo APENAS estende actors
*/

BEGIN;

-- ============================================================
-- EXTENSÃO DE ACTORS (SOCIAL)
-- ============================================================

ALTER TABLE actors
  ADD COLUMN IF NOT EXISTS actor_type TEXT
    CHECK (actor_type IN ('user','page','group','channel')),
  ADD COLUMN IF NOT EXISTS user_id UUID
    REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS company_id UUID
    REFERENCES companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS group_id UUID
    REFERENCES groups(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_url TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Garantias lógicas por tipo
ALTER TABLE actors
  ADD CONSTRAINT actors_type_reference CHECK (
    (actor_type = 'user' AND user_id IS NOT NULL AND company_id IS NULL AND group_id IS NULL) OR
    (actor_type = 'page' AND company_id IS NOT NULL AND user_id IS NULL AND group_id IS NULL) OR
    (actor_type = 'group' AND group_id IS NOT NULL AND user_id IS NULL AND company_id IS NULL) OR
    (actor_type = 'channel' AND user_id IS NULL AND company_id IS NULL AND group_id IS NULL)
  );

-- Unicidade lógica
CREATE UNIQUE INDEX IF NOT EXISTS idx_actors_unique_user
  ON actors (user_id)
  WHERE actor_type = 'user';

CREATE UNIQUE INDEX IF NOT EXISTS idx_actors_unique_company
  ON actors (company_id)
  WHERE actor_type = 'page';

CREATE UNIQUE INDEX IF NOT EXISTS idx_actors_unique_group
  ON actors (group_id)
  WHERE actor_type = 'group';

CREATE UNIQUE INDEX IF NOT EXISTS idx_actors_slug_unique
  ON actors (tenant_id, slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_actors_type
  ON actors (actor_type);

-- ============================================================
-- POST MEDIA
-- ============================================================

CREATE TABLE post_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image','video','audio','document')),
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size BIGINT,
  mime_type TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_post_media_post ON post_media (post_id);

ALTER TABLE post_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY post_media_rls ON post_media
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- REACTIONS
-- ============================================================

CREATE TABLE reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL DEFAULT 'like'
    CHECK (reaction_type IN ('like','love','haha','wow','sad','angry')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, global_user_id)
);

ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY reactions_rls ON reactions
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- COMMENTS
-- ============================================================

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY comments_rls ON comments
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- POSTS → ACTORS
-- ============================================================

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS actor_id UUID
    REFERENCES actors(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_posts_actor
  ON posts (actor_id)
  WHERE actor_id IS NOT NULL;

-- ============================================================
-- COVER IMAGES
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS cover_url TEXT;

COMMIT;
