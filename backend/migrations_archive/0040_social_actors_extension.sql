/*
Arquivo: 060_social_actors_extension.sql
Projeto: UnifiCard
Banco: PostgreSQL 14+
Escopo: Extensão social do domínio ACTORS (Social 2.0)

IMPORTANTE:
- actors JÁ EXISTE (SSOT)
- Este arquivo APENAS estende actors
- Nenhuma identidade paralela é criada
*/

BEGIN;

-- ============================================================
-- EXTENSÃO SOCIAL DE ACTORS (SEM TOCAR NO CORE)
-- ============================================================

ALTER TABLE actors
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_url TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Unicidade lógica de slug por tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_actors_social_slug
  ON actors (tenant_id, slug)
  WHERE slug IS NOT NULL;

-- ============================================================
-- POST MEDIA
-- ============================================================

CREATE TABLE IF NOT EXISTS post_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  post_id UUID NOT NULL,
  media_type TEXT NOT NULL
    CHECK (media_type IN ('image','video','audio','document')),
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size BIGINT,
  mime_type TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_media_post
  ON post_media (post_id);

ALTER TABLE post_media ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'post_media'
      AND policyname = 'post_media_rls'
  ) THEN
    CREATE POLICY post_media_rls ON post_media
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- REACTIONS (SEM global_users)
-- ============================================================

CREATE TABLE IF NOT EXISTS reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  post_id UUID NOT NULL,
  actor_id UUID NOT NULL REFERENCES actors(id) ON DELETE CASCADE,

  reaction_type TEXT NOT NULL DEFAULT 'like'
    CHECK (reaction_type IN ('like','love','haha','wow','sad','angry')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (post_id, actor_id)
);

ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reactions'
      AND policyname = 'reactions_rls'
  ) THEN
    CREATE POLICY reactions_rls ON reactions
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- COMMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  post_id UUID NOT NULL,
  actor_id UUID NOT NULL REFERENCES actors(id) ON DELETE CASCADE,

  content TEXT NOT NULL,
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'comments'
      AND policyname = 'comments_rls'
  ) THEN
    CREATE POLICY comments_rls ON comments
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- POSTS → ACTORS (EXTENSÃO SEGURA)
-- ============================================================

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS actor_id UUID
    REFERENCES actors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_actor
  ON posts (actor_id)
  WHERE actor_id IS NOT NULL;

-- ============================================================
-- COVER IMAGES (EXTENSÃO NÃO-INTRUSIVA)
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cover_url TEXT;

COMMIT;
