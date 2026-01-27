-- ============================================================
-- UNIFICARD - MIGRATION 286b
-- CORE DE PERMISSÕES FINANCEIRAS — FASE 2 (PASSO 3/3)
-- Renomear constraints para nomes mais descritivos
-- ============================================================
--
-- OBJETIVO:
-- Padronizar nomes de constraints para melhor legibilidade e manutenção.
--
-- ============================================================

-- ============================================================
-- TABELA: bank_transactions
-- ============================================================

-- Substituir constraint única por duas constraints separadas (mais descritivas)
ALTER TABLE bank_transactions
  DROP CONSTRAINT IF EXISTS chk_bank_transactions_system_user_id;

-- Constraint 1: Se system, user_id DEVE ser NULL
ALTER TABLE bank_transactions
  ADD CONSTRAINT chk_bank_transactions_system_user_id_null
  CHECK (
    authority_source != 'system' OR performed_by_user_id IS NULL
  );

-- Constraint 2: Se não system, user_id DEVE ser NOT NULL
ALTER TABLE bank_transactions
  ADD CONSTRAINT chk_bank_transactions_non_system_user_id_not_null
  CHECK (
    authority_source = 'system' OR performed_by_user_id IS NOT NULL
  );

-- ============================================================
-- TABELA: bank_ledger
-- ============================================================

-- Substituir constraint única por duas constraints separadas (mais descritivas)
ALTER TABLE bank_ledger
  DROP CONSTRAINT IF EXISTS chk_bank_ledger_system_user_id;

-- Constraint 1: Se system, user_id DEVE ser NULL
ALTER TABLE bank_ledger
  ADD CONSTRAINT chk_bank_ledger_system_user_id_null
  CHECK (
    authority_source != 'system' OR performed_by_user_id IS NULL
  );

-- Constraint 2: Se não system, user_id DEVE ser NOT NULL
ALTER TABLE bank_ledger
  ADD CONSTRAINT chk_bank_ledger_non_system_user_id_not_null
  CHECK (
    authority_source = 'system' OR performed_by_user_id IS NOT NULL
  );

-- ============================================================
-- TABELA: bank_splits
-- ============================================================

-- Substituir constraint única por duas constraints separadas (mais descritivas)
ALTER TABLE bank_splits
  DROP CONSTRAINT IF EXISTS chk_bank_splits_system_user_id;

-- Constraint 1: Se system, user_id DEVE ser NULL
ALTER TABLE bank_splits
  ADD CONSTRAINT chk_bank_splits_system_user_id_null
  CHECK (
    authority_source != 'system' OR performed_by_user_id IS NULL
  );

-- Constraint 2: Se não system, user_id DEVE ser NOT NULL
ALTER TABLE bank_splits
  ADD CONSTRAINT chk_bank_splits_non_system_user_id_not_null
  CHECK (
    authority_source = 'system' OR performed_by_user_id IS NOT NULL
  );

-- ============================================================
-- COMENTÁRIOS ATUALIZADOS
-- ============================================================

COMMENT ON CONSTRAINT chk_bank_transactions_system_user_id_null ON bank_transactions IS
  'Garante que operações do sistema (authority_source=system) não têm performed_by_user_id';

COMMENT ON CONSTRAINT chk_bank_transactions_non_system_user_id_not_null ON bank_transactions IS
  'Garante que operações de usuário (ownership/delegation/account_acl) têm performed_by_user_id';

COMMENT ON CONSTRAINT chk_bank_ledger_system_user_id_null ON bank_ledger IS
  'Garante que operações do sistema (authority_source=system) não têm performed_by_user_id';

COMMENT ON CONSTRAINT chk_bank_ledger_non_system_user_id_not_null ON bank_ledger IS
  'Garante que operações de usuário (ownership/delegation/account_acl) têm performed_by_user_id';

COMMENT ON CONSTRAINT chk_bank_splits_system_user_id_null ON bank_splits IS
  'Garante que operações do sistema (authority_source=system) não têm performed_by_user_id';

COMMENT ON CONSTRAINT chk_bank_splits_non_system_user_id_not_null ON bank_splits IS
  'Garante que operações de usuário (ownership/delegation/account_acl) têm performed_by_user_id';

