-- ================================================
-- UNIFICARD - MIGRATION 089
-- Add token_version to users table
-- Suporta invalidação de tokens JWT no logout
-- ================================================

-- ===========================
-- ADD TOKEN_VERSION COLUMN
-- ===========================
-- Adiciona coluna token_version à tabela users
-- - Tipo: INTEGER
-- - Default: 0 (todos os usuários existentes começam com versão 0)
-- - NOT NULL: obrigatório para garantir consistência
ALTER TABLE users
ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

-- ===========================
-- COMENTÁRIOS
-- ===========================
COMMENT ON COLUMN users.token_version IS 'Versão do token JWT para invalidação de sessões (logout global)';

