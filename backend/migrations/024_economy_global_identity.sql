-- ================================================
-- UNIFICARD - MIGRATION 024
-- Adiciona suporte a global_user_id em economy (accounts, transactions)
-- ================================================

-- ===========================
-- ACCOUNTS - Adicionar global_user_id
-- ===========================
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS owner_global_user_id UUID REFERENCES global_users(global_user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_owner_global_user ON accounts (owner_global_user_id) WHERE owner_global_user_id IS NOT NULL AND owner_type = 'user';

-- ===========================
-- TRANSACTIONS - Adicionar global_user_id (do from_account)
-- ===========================
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS from_global_user_id UUID REFERENCES global_users(global_user_id) ON DELETE SET NULL;

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS to_global_user_id UUID REFERENCES global_users(global_user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_from_global_user ON transactions (from_global_user_id) WHERE from_global_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_to_global_user ON transactions (to_global_user_id) WHERE to_global_user_id IS NOT NULL;

-- ===========================
-- COMENTÁRIOS
-- ===========================
COMMENT ON COLUMN accounts.owner_global_user_id IS 'Identidade global do owner quando owner_type = user (opcional, mantém compatibilidade com owner_id)';
COMMENT ON COLUMN transactions.from_global_user_id IS 'Identidade global do usuário da conta origem (quando aplicável)';
COMMENT ON COLUMN transactions.to_global_user_id IS 'Identidade global do usuário da conta destino (quando aplicável)';








