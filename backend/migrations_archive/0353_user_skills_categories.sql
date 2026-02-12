-- ============================================================
-- UNIFICARD — MIGRATION 044
-- Arquivo: 044_create_user_skills_categories.sql
-- Tipo: FUNDACIONAL (criação de tabela base)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- A migration 045_expand_professional_services.sql precisa
-- alterar a tabela user_skills_categories, mas ela ainda
-- não existe quando a 045 executa.
--
-- OBJETIVO
-- Criar a tabela user_skills_categories com estrutura base
-- mínima necessária para que migrations posteriores possam
-- fazer ALTER TABLE.
--
-- ESTRUTURA
-- • id (UUID, PK)
-- • global_user_id (FK para global_users)
-- • category_id (FK para categories)
-- • created_at, updated_at (auditoria)
-- • constraint UNIQUE (global_user_id, category_id)
--
-- DEPENDÊNCIAS
-- • global_users (deve existir)
-- • categories (deve existir)
-- • função update_updated_at_column() (deve existir)
-- • extensão uuid-ossp (deve existir)
--
-- OBSERVAÇÕES
-- • Campos adicionais (pricing_type, years_experience, etc)
--   serão adicionados pela migration 060_category_core_canonical.sql
-- • Esta migration cria apenas a estrutura base mínima
--
-- IDEMPOTÊNCIA
-- • Usa IF NOT EXISTS para permitir execução múltipla
-- ============================================================

BEGIN;

-- ============================================================
-- TABELA: user_skills_categories
-- ============================================================

CREATE TABLE IF NOT EXISTS user_skills_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  global_user_id UUID NOT NULL
    REFERENCES global_users(global_user_id)
    ON DELETE CASCADE,
  
  category_id UUID NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT user_skills_categories_unique
    UNIQUE (global_user_id, category_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_user_skills_categories_user
  ON user_skills_categories (global_user_id);

CREATE INDEX IF NOT EXISTS idx_user_skills_categories_category
  ON user_skills_categories (category_id);

-- ============================================================
-- COMENTÁRIOS
-- ============================================================

COMMENT ON TABLE user_skills_categories IS
'Skills e categorias profissionais associadas a usuários globais (estrutura base)';

COMMENT ON COLUMN user_skills_categories.global_user_id IS
'Referência ao usuário global que possui esta skill';

COMMENT ON COLUMN user_skills_categories.category_id IS
'Referência à categoria/skill profissional';

COMMIT;

