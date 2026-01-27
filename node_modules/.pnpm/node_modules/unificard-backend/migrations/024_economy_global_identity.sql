/*
Arquivo: 024_add_global_user_to_economy.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Escopo: Integração do Global User ID com o módulo Economy (accounts e transactions)

Objetivo:
- Associar contas e transações a uma identidade global de usuário
- Manter compatibilidade total com owner_id / user_id locais
- Preparar base para histórico financeiro cross-tenant

Dependências:
- accounts
- transactions
- global_users (022_global_identity.sql)

Observações:
- Colunas opcionais (SET NULL)
- Não altera regras contábeis
- Não substitui owner_id / user_id existentes
*/

-- =========================================================
-- ACCOUNTS: GLOBAL OWNER
-- =========================================================

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS owner_global_user_id UUID
  REFERENCES global_users(global_user_id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_owner_global_user
  ON accounts (owner_global_user_id)
  WHERE owner_global_user_id IS NOT NULL
    AND owner_type = 'user';

-- =========================================================
-- TRANSACTIONS: GLOBAL USERS (FROM / TO)
-- =========================================================

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS from_global_user_id UUID
  REFERENCES global_users(global_user_id)
  ON DELETE SET NULL;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS to_global_user_id UUID
  REFERENCES global_users(global_user_id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_from_global_user
  ON transactions (from_global_user_id)
  WHERE from_global_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_to_global_user
  ON transactions (to_global_user_id)
  WHERE to_global_user_id IS NOT NULL;

-- =========================================================
-- COMENTÁRIOS
-- =========================================================

COMMENT ON COLUMN accounts.owner_global_user_id IS
  'Identidade global do owner quando owner_type = user (opcional, compatível com owner_id)';

COMMENT ON COLUMN transactions.from_global_user_id IS
  'Identidade global do usuário da conta de origem (quando aplicável)';

COMMENT ON COLUMN transactions.to_global_user_id IS
  'Identidade global do usuário da conta de destino (quando aplicável)';













