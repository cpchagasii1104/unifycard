-- ============================================================
-- UNIFICARD — CATEGORY CORE CANÔNICO
-- Arquivo: 060_category_core_canonical.sql
-- Banco alvo: PostgreSQL 14+
--
-- Núcleo canônico único de categorias do sistema.
-- Este arquivo SUBSTITUI definitivamente:
-- - 040_categories_system.sql
-- - 118_category_core.sql
-- - 119_category_core_bridge.sql
-- - 055_categories_ai_blindage.sql
-- - 057_add_auto_active_status.sql
-- ============================================================

BEGIN;

-- ============================================================
-- EXTENSÕES NECESSÁRIAS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- FUNÇÃO AUXILIAR: NORMALIZAÇÃO DE SLUG
-- ============================================================

CREATE OR REPLACE FUNCTION normalize_category_slug(name_text TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(
    REPLACE(
      TRANSLATE(
        TRIM(name_text),
        'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
        'aaaaaeeeeiiiioooouuuucnAAAAAEEEEIIIIOOOOUUUUCN'
      ),
      ' ',
      '-'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- ENUMS CANÔNICOS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'category_status') THEN
    CREATE TYPE category_status AS ENUM (
      'active',
      'auto_active',
      'pending',
      'rejected',
      'archived'
    );
  END IF;
END$$;

-- ============================================================
-- TABELA CANÔNICA: CATEGORIES
-- ============================================================

CREATE TABLE IF NOT EXISTS categories (
  category_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identidade
  slug VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Hierarquia
  parent_id UUID REFERENCES categories(category_id) ON DELETE SET NULL,
  level INTEGER NOT NULL DEFAULT 0 CHECK (level >= 0),
  path TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  -- Escopo semântico
  scope VARCHAR(50) NOT NULL DEFAULT 'global'
    CHECK (scope IN (
      'global',
      'group',
      'company',
      'event',
      'campaign',
      'professional',
      'interest',
      'learning',
      'cause'
    )),

  -- Localização
  country_code CHAR(2),

  -- Busca
  keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  -- Governança e status
  status category_status NOT NULL DEFAULT 'active',
  requires_review BOOLEAN NOT NULL DEFAULT false,
  created_by_ai BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Apresentação e extensão
  icon VARCHAR(50),
  color VARCHAR(7),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT categories_parent_not_self
    CHECK (parent_id IS NULL OR parent_id <> category_id),

  CONSTRAINT categories_country_code_format
    CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),

  CONSTRAINT categories_unique_slug
    UNIQUE (slug, country_code)
);

-- ============================================================
-- TRIGGER: PATH E LEVEL AUTOMÁTICOS
-- ============================================================

CREATE OR REPLACE FUNCTION categories_before_write()
RETURNS TRIGGER AS $$
DECLARE
  parent_path TEXT[];
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.level := 0;
    NEW.path := ARRAY[NEW.slug];
    RETURN NEW;
  END IF;

  SELECT path INTO parent_path
  FROM categories
  WHERE category_id = NEW.parent_id;

  IF parent_path IS NULL THEN
    RAISE EXCEPTION 'Parent category % not found', NEW.parent_id;
  END IF;

  IF NEW.category_id::text = ANY(parent_path) THEN
    RAISE EXCEPTION 'Cyclic category hierarchy detected';
  END IF;

  NEW.path := parent_path || NEW.slug;
  NEW.level := array_length(NEW.path, 1) - 1;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_categories_before_write
  BEFORE INSERT OR UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION categories_before_write();

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_categories_parent
  ON categories (parent_id);

CREATE INDEX IF NOT EXISTS idx_categories_level
  ON categories (level);

CREATE INDEX IF NOT EXISTS idx_categories_path
  ON categories USING GIN (path);

CREATE INDEX IF NOT EXISTS idx_categories_scope_active
  ON categories (scope) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_categories_status_pending
  ON categories (status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_categories_keywords
  ON categories USING GIN (keywords);

CREATE INDEX IF NOT EXISTS idx_categories_name_trgm
  ON categories USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_categories_country_parent
  ON categories (country_code, parent_id);

-- ============================================================
-- TABELAS DE ASSOCIAÇÃO
-- ============================================================

-- Company Categories (multi-tenant)
CREATE TABLE IF NOT EXISTS company_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id)
    ON DELETE CASCADE,
  company_id UUID NOT NULL,
  category_id UUID NOT NULL
    REFERENCES categories(category_id)
    ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT company_categories_unique
    UNIQUE (tenant_id, company_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_company_categories_tenant
  ON company_categories (tenant_id);

CREATE INDEX IF NOT EXISTS idx_company_categories_company
  ON company_categories (company_id);

CREATE INDEX IF NOT EXISTS idx_company_categories_category
  ON company_categories (category_id);

ALTER TABLE company_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_categories_rls
  ON company_categories
  USING (tenant_id::text = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));

-- User Skills Categories (global)
CREATE TABLE IF NOT EXISTS user_skills_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  global_user_id UUID NOT NULL
    REFERENCES global_users(global_user_id)
    ON DELETE CASCADE,
  category_id UUID NOT NULL
    REFERENCES categories(category_id)
    ON DELETE CASCADE,
  skill_level INTEGER NOT NULL DEFAULT 0
    CHECK (skill_level BETWEEN 0 AND 100),
  years_experience INTEGER NOT NULL DEFAULT 0
    CHECK (years_experience >= 0),
  hourly_rate NUMERIC(10,2) NULL
    CHECK (hourly_rate IS NULL OR hourly_rate >= 0),
  pricing_type VARCHAR(20) NOT NULL DEFAULT 'hourly'
    CHECK (pricing_type IN ('hourly', 'daily', 'weekly', 'monthly', 'quote')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_skills_categories_unique
    UNIQUE (global_user_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_user_skills_categories_user
  ON user_skills_categories (global_user_id);

CREATE INDEX IF NOT EXISTS idx_user_skills_categories_category
  ON user_skills_categories (category_id);

CREATE TRIGGER trg_user_skills_categories_updated_at
  BEFORE UPDATE ON user_skills_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Post Categories
CREATE TABLE IF NOT EXISTS post_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL,
  category_id UUID NOT NULL
    REFERENCES categories(category_id)
    ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT post_categories_unique
    UNIQUE (post_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_post_categories_post
  ON post_categories (post_id);

CREATE INDEX IF NOT EXISTS idx_post_categories_category
  ON post_categories (category_id);

-- Product Categories
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL,
  category_id UUID NOT NULL
    REFERENCES categories(category_id)
    ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_categories_unique
    UNIQUE (product_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_product_categories_product
  ON product_categories (product_id);

CREATE INDEX IF NOT EXISTS idx_product_categories_category
  ON product_categories (category_id);

-- Service Categories
CREATE TABLE IF NOT EXISTS service_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL,
  category_id UUID NOT NULL
    REFERENCES categories(category_id)
    ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_categories_unique
    UNIQUE (service_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_service_categories_service
  ON service_categories (service_id);

CREATE INDEX IF NOT EXISTS idx_service_categories_category
  ON service_categories (category_id);

-- ============================================================
-- AUDITORIA DE IA
-- ============================================================

CREATE TABLE IF NOT EXISTS category_ai_logs (
  log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE SET NULL,
  actor_id UUID,
  global_user_id UUID REFERENCES global_users(global_user_id) ON DELETE SET NULL,

  input_type VARCHAR(20) CHECK (input_type IN ('text', 'voice', 'transcription')),
  original_text TEXT NOT NULL,
  sanitized_text TEXT NOT NULL,
  text_hash VARCHAR(64) NOT NULL,
  audio_hash VARCHAR(64),
  audio_url TEXT,

  context VARCHAR(30),
  ai_suggestion JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_confidence NUMERIC(3,2) NOT NULL DEFAULT 0.5 CHECK (ai_confidence BETWEEN 0 AND 1),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_category_ai_logs_category
  ON category_ai_logs (category_id);

CREATE INDEX IF NOT EXISTS idx_category_ai_logs_text_hash
  ON category_ai_logs (text_hash);

ALTER TABLE category_ai_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- COMENTÁRIOS FINAIS
-- ============================================================

COMMENT ON TABLE categories IS
'Core canônico e único de categorias hierárquicas do sistema UnifiCard';

COMMENT ON TABLE category_ai_logs IS
'Auditoria completa e imutável de categorias criadas ou sugeridas por IA';

COMMENT ON TABLE user_skills_categories IS
'Skills e categorias profissionais associadas a usuários globais';

COMMENT ON COLUMN user_skills_categories.pricing_type IS
'Tipo de cobrança: hourly, daily, weekly, monthly ou quote';

COMMENT ON COLUMN user_skills_categories.years_experience IS
'Anos de experiência do usuário na categoria/skill';

COMMENT ON COLUMN user_skills_categories.hourly_rate IS
'Taxa horária do profissional para esta skill (opcional, usado quando pricing_type = hourly)';

COMMIT;

