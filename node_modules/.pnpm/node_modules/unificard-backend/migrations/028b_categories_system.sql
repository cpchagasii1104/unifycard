-- ================================================
-- UNIFICARD - MIGRATION 028
-- Categories System
-- Sistema global de taxonomia e categorização
-- ================================================

-- ===========================
-- CATEGORIES (Hierarquia recursiva)
-- ===========================
CREATE TABLE IF NOT EXISTS categories (
  category_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID REFERENCES categories(category_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  level INT NOT NULL DEFAULT 0,
  path TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories (slug);
CREATE INDEX IF NOT EXISTS idx_categories_level ON categories (level);
CREATE INDEX IF NOT EXISTS idx_categories_path ON categories USING GIN (path);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_categories_updated_at();

-- ===========================
-- COMPANY CATEGORIES
-- ===========================
CREATE TABLE IF NOT EXISTS company_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT company_categories_unique UNIQUE (tenant_id, company_id, category_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_company_categories_tenant ON company_categories (tenant_id);
CREATE INDEX IF NOT EXISTS idx_company_categories_company ON company_categories (company_id);
CREATE INDEX IF NOT EXISTS idx_company_categories_category ON company_categories (category_id);

-- RLS
ALTER TABLE company_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_categories_rls ON company_categories
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ===========================
-- USER SKILLS CATEGORIES
-- ===========================
CREATE TABLE IF NOT EXISTS user_skills_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
  skill_level INT NOT NULL DEFAULT 0 CHECK (skill_level >= 0 AND skill_level <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_skills_categories_unique UNIQUE (global_user_id, category_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_skills_categories_user ON user_skills_categories (global_user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_categories_category ON user_skills_categories (category_id);

-- Trigger para updated_at
CREATE TRIGGER trigger_update_user_skills_categories_updated_at
  BEFORE UPDATE ON user_skills_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_categories_updated_at();

-- ===========================
-- POST CATEGORIES
-- ===========================
CREATE TABLE IF NOT EXISTS post_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT post_categories_unique UNIQUE (post_id, category_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_post_categories_post ON post_categories (post_id);
CREATE INDEX IF NOT EXISTS idx_post_categories_category ON post_categories (category_id);

-- ===========================
-- PRODUCT CATEGORIES
-- ===========================
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_categories_unique UNIQUE (product_id, category_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_product_categories_product ON product_categories (product_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_category ON product_categories (category_id);

-- ===========================
-- SERVICE CATEGORIES
-- ===========================
CREATE TABLE IF NOT EXISTS service_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_categories_unique UNIQUE (service_id, category_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_service_categories_service ON service_categories (service_id);
CREATE INDEX IF NOT EXISTS idx_service_categories_category ON service_categories (category_id);

-- ===========================
-- COMENTÁRIOS
-- ===========================
COMMENT ON TABLE categories IS 'Categorias hierárquicas globais do sistema';
COMMENT ON COLUMN categories.parent_id IS 'Categoria pai (NULL para categorias raiz)';
COMMENT ON COLUMN categories.level IS 'Nível na hierarquia (0 = raiz)';
COMMENT ON COLUMN categories.path IS 'Array de slugs do caminho completo (ex: ["tecnologia", "software", "desenvolvimento"])';
COMMENT ON TABLE company_categories IS 'Categorias associadas a empresas';
COMMENT ON TABLE user_skills_categories IS 'Skills/categorias associadas a usuários globais';
COMMENT ON TABLE post_categories IS 'Categorias associadas a posts';
COMMENT ON TABLE product_categories IS 'Categorias associadas a produtos';
COMMENT ON TABLE service_categories IS 'Categorias associadas a serviços';








