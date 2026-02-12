-- ============================================================
-- UNIFICARD — MIGRATION 060
-- Arquivo: 060_user_education_and_companies.sql
-- Tipo: RELACIONAMENTO / PERFIL DO USUÁRIO
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Esta migration introduz tabelas de relacionamento entre
-- usuários globais e categorias validadas pelo sistema,
-- representando:
--
-- • formação educacional (user_education)
-- • atuação profissional / empresas (user_companies)
--
-- Essas tabelas NÃO representam entidades próprias,
-- apenas vínculos semânticos entre usuários e categorias
-- aprovadas pelo Category Input Gate.
--
-- ARQUITETURA
-- • As categorias referenciadas vêm do módulo categories
--   com governança (migrations 055–058)
-- • O input dessas categorias passa por validação
--   (migration 059)
--
-- GOVERNANÇA
-- • Essas tabelas NÃO criam categorias
-- • Não validam status (active/auto_active/etc.)
-- • O enforcement é responsabilidade da aplicação
--
-- RLS
-- • Dados sensíveis de perfil
-- • Usuário só pode acessar seus próprios registros
-- • Sem tenant_id por design (perfil global)
--
-- IDEMPOTÊNCIA
-- • Todas as estruturas usam IF NOT EXISTS
-- • Triggers seguem padrão do projeto
--
-- DEPENDÊNCIAS
-- • global_users
-- • categories
-- • update_updated_at_column()
--
-- ============================================================


-- ============================================================
-- 1) USER EDUCATION
-- ============================================================

CREATE TABLE IF NOT EXISTS user_education (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  global_user_id UUID NOT NULL
    REFERENCES global_users(global_user_id)
    ON DELETE CASCADE,

  category_id UUID NOT NULL
    REFERENCES categories(category_id)
    ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT user_education_unique
    UNIQUE (global_user_id, category_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_education_user
  ON user_education (global_user_id);

CREATE INDEX IF NOT EXISTS idx_user_education_category
  ON user_education (category_id);

-- RLS
ALTER TABLE user_education ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_education_rls
  ON user_education
  USING (
    global_user_id::text = current_setting('app.current_global_user', true)
  );

-- Trigger updated_at
CREATE TRIGGER trg_user_education_updated_at
  BEFORE UPDATE ON user_education
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 2) USER COMPANIES (ATUAÇÃO / SETOR / TIPO DE EMPRESA)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  global_user_id UUID NOT NULL
    REFERENCES global_users(global_user_id)
    ON DELETE CASCADE,

  category_id UUID NOT NULL
    REFERENCES categories(category_id)
    ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT user_companies_unique
    UNIQUE (global_user_id, category_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_companies_user
  ON user_companies (global_user_id);

CREATE INDEX IF NOT EXISTS idx_user_companies_category
  ON user_companies (category_id);

-- RLS
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_companies_rls
  ON user_companies
  USING (
    global_user_id::text = current_setting('app.current_global_user', true)
  );

-- Trigger updated_at
CREATE TRIGGER trg_user_companies_updated_at
  BEFORE UPDATE ON user_companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- COMENTÁRIOS
-- ============================================================

COMMENT ON TABLE user_education IS
  'Formações acadêmicas do usuário vinculadas a categorias validadas (contexto: education)';

COMMENT ON TABLE user_companies IS
  'Áreas de atuação, setores ou tipos de empresa do usuário (NÃO representa PJ real)';

COMMENT ON COLUMN user_education.category_id IS
  'Categoria validada via Category Input Gate (contexto: education)';

COMMENT ON COLUMN user_companies.category_id IS
  'Categoria validada via Category Input Gate (contexto: professional/company)';


-- ============================================================
-- FIM 060_user_education_and_companies.sql
-- ============================================================





