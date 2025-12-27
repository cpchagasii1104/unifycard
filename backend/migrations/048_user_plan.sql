-- ================================================
-- UNIFICARD - MIGRATION 048
-- Adiciona campo plan e is_test na tabela users
-- FASE 3.6: Suporte a planos FREE/PRO/ENTERPRISE
-- ================================================

-- Adicionar coluna plan na tabela users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise'));

-- Adicionar coluna is_test para usuários de teste
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT false;

-- Criar índice para busca por plano
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);

-- Atualizar comentários
COMMENT ON COLUMN users.plan IS 'Plano do usuário: free, pro ou enterprise';
COMMENT ON COLUMN users.is_test IS 'Indica se é usuário de teste (pode alternar plano)';
