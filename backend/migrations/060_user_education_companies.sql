-- ============================================
-- 060_user_education_companies.sql
-- Tabelas para educação e empresas do usuário
-- FASE 2: Educação + Empresa (Unify Platform)
-- ============================================

-- ===========================
-- USER EDUCATION
-- ===========================
CREATE TABLE IF NOT EXISTS user_education (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_education_unique UNIQUE (global_user_id, category_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_education_user ON user_education (global_user_id);
CREATE INDEX IF NOT EXISTS idx_user_education_category ON user_education (category_id);

-- Trigger para updated_at
CREATE TRIGGER trigger_update_user_education_updated_at
  BEFORE UPDATE ON user_education
  FOR EACH ROW
  EXECUTE FUNCTION update_categories_updated_at();

-- ===========================
-- USER COMPANIES
-- ===========================
CREATE TABLE IF NOT EXISTS user_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_companies_unique UNIQUE (global_user_id, category_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_companies_user ON user_companies (global_user_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_category ON user_companies (category_id);

-- Trigger para updated_at
CREATE TRIGGER trigger_update_user_companies_updated_at
  BEFORE UPDATE ON user_companies
  FOR EACH ROW
  EXECUTE FUNCTION update_categories_updated_at();

-- ===========================
-- COMENTÁRIOS
-- ===========================
COMMENT ON TABLE user_education IS 'Formações acadêmicas do usuário (relacionamento com categorias)';
COMMENT ON TABLE user_companies IS 'Empresas onde o usuário trabalha/trabalhou (relacionamento com categorias)';
COMMENT ON COLUMN user_education.category_id IS 'Categoria criada/validada via Category Input Gate (contexto: education)';
COMMENT ON COLUMN user_companies.category_id IS 'Categoria criada/validada via Category Input Gate (contexto: company)';















