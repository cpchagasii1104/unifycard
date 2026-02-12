-- ============================================================
-- UNIFICARD - MIGRATION 089
-- Add token_version to users table
-- ============================================================
--
-- OBJETIVO:
-- Permitir invalidação global de sessões JWT através de
-- versionamento de tokens por usuário.
--
-- GOVERNANÇA (EXPLÍCITA):
-- - O BANCO:
--   • armazena a versão atual do token por usuário
-- - A APLICAÇÃO:
--   • inclui token_version no payload do JWT
--   • compara token_version do JWT com users.token_version
--   • incrementa token_version no logout global ou reset de sessão
-- - O BANCO NÃO:
--   • invalida tokens automaticamente
--   • gerencia sessões
--
-- DECISÕES IMPORTANTES:
-- - token_version inicia em 0 para todos os usuários existentes
-- - Campo é NOT NULL para garantir consistência de comparação
-- - Não há CHECK para permitir resets emergenciais
--
-- DEPENDÊNCIAS:
-- - Tabela users
--
-- IMPACTO:
-- - Nenhuma alteração destrutiva
-- - Executa isoladamente
-- ============================================================


-- ===========================
-- ADD TOKEN_VERSION COLUMN
-- ===========================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;


-- ===========================
-- COMENTÁRIOS
-- ===========================
COMMENT ON COLUMN users.token_version IS
  'Versão do token JWT para invalidação de sessões (logout global)';
