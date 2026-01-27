-- ============================================================
-- UNIFICARD - MIGRATION 216
-- SPRINT 79: PÁGINAS PÚBLICAS (ARTISTAS, EMPRESAS, EVENTOS)
-- Tabela: public_profiles
-- ============================================================
--
-- OBJETIVO:
-- Criar sistema de páginas públicas canônicas, integradas ao feed social,
-- marketplace e eventos, SEM executar economia.
--
-- REGRAS:
-- - Perfil público ≠ Usuário
-- - Perfil público ≠ Empresa
-- - Um actor pode ter vários perfis
-- - Slug único por tenant
-- - Perfil PUBLIC aparece: Feed, Eventos, Marketplace
-- - Perfil PRIVATE não aparece publicamente
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

-- Profile Type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'public_profile_type') THEN
    CREATE TYPE public_profile_type AS ENUM (
      'ARTIST',   -- Artista individual
      'BAND',     -- Banda
      'COMPANY',  -- Empresa
      'VENUE'     -- Casa de eventos
    );
  END IF;
END$$;

-- Visibility
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'public_profile_visibility') THEN
    CREATE TYPE public_profile_visibility AS ENUM (
      'PUBLIC',   -- Público (aparece no feed, eventos, marketplace)
      'PRIVATE'   -- Privado (não aparece publicamente)
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: public_profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public_profiles (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Actor (dono do perfil)
    actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    
    -- Tipo e identificação
    profile_type public_profile_type NOT NULL,
    slug VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    
    -- Conteúdo
    bio TEXT,
    avatar_url TEXT,
    cover_url TEXT,
    
    -- Visibilidade
    visibility public_profile_visibility NOT NULL DEFAULT 'PUBLIC',
    
    -- Metadados
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT public_profiles_slug_unique UNIQUE (tenant_id, slug)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_public_profiles_tenant_id
    ON public_profiles(tenant_id);

-- Índice para buscar por actor
CREATE INDEX IF NOT EXISTS idx_public_profiles_actor
    ON public_profiles(tenant_id, actor_id);

-- Índice para buscar por slug
CREATE INDEX IF NOT EXISTS idx_public_profiles_slug
    ON public_profiles(tenant_id, slug);

-- Índice para buscar por tipo
CREATE INDEX IF NOT EXISTS idx_public_profiles_type
    ON public_profiles(tenant_id, profile_type);

-- Índice para buscar públicos
CREATE INDEX IF NOT EXISTS idx_public_profiles_public
    ON public_profiles(tenant_id, visibility)
    WHERE visibility = 'PUBLIC';

-- Índice composto para listagem pública
CREATE INDEX IF NOT EXISTS idx_public_profiles_public_type
    ON public_profiles(tenant_id, profile_type, visibility)
    WHERE visibility = 'PUBLIC';

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem profiles do próprio tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'public_profiles'
      AND policyname = 'public_profiles_tenant_isolation'
  ) THEN
    CREATE POLICY public_profiles_tenant_isolation
      ON public_profiles
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- TRIGGERS
-- ============================================================
-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_public_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_public_profiles_updated_at
    BEFORE UPDATE ON public_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_public_profiles_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE public_profiles IS 'Páginas públicas canônicas. Perfil público ≠ Usuário. Perfil público ≠ Empresa. Um actor pode ter vários perfis.';
COMMENT ON COLUMN public_profiles.actor_id IS 'Actor (dono do perfil)';
COMMENT ON COLUMN public_profiles.profile_type IS 'Tipo: ARTIST, BAND, COMPANY, VENUE';
COMMENT ON COLUMN public_profiles.slug IS 'Slug único por tenant (URL-friendly)';
COMMENT ON COLUMN public_profiles.visibility IS 'PUBLIC: aparece no feed, eventos, marketplace. PRIVATE: não aparece publicamente.';






