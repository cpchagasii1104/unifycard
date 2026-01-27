-- ============================================================
-- UNIFICARD - MIGRATION 286
-- CORE DE PERMISSÕES FINANCEIRAS — FASE 2 (PASSO 2/3)
-- Endurecimento do banco: NOT NULL + CHECK constraints
-- ============================================================
--
-- OBJETIVO:
-- Transformar autoria financeira em REGRA INQUEBRÁVEL.
-- Após esta migration, NÃO É POSSÍVEL criar transação, ledger ou split sem autoria explícita.
--
-- REGRAS ARQUITETURAIS:
-- - Campos obrigatórios: acting_for_account_id, authority_source, permission_snapshot
-- - performed_by_user_id permanece NULLABLE (system pode ser NULL)
-- - CHECK constraints garantem consistência entre authority_source e performed_by_user_id
--
-- ============================================================

-- ============================================================
-- TABELA: bank_transactions
-- ============================================================

-- Limpar dados inválidos ANTES de aplicar NOT NULL
-- Converter strings vazias e valores inválidos para NULL
UPDATE bank_transactions
SET 
  acting_for_account_id = NULLIF(acting_for_account_id::text, '')::uuid
WHERE acting_for_account_id::text = '' OR acting_for_account_id IS NULL;

UPDATE bank_transactions
SET 
  performed_by_user_id = NULLIF(performed_by_user_id::text, '')::uuid
WHERE performed_by_user_id::text = '' OR (performed_by_user_id IS NOT NULL AND performed_by_user_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

-- Garantir que não há NULLs antes de aplicar NOT NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM bank_transactions WHERE acting_for_account_id IS NULL) THEN
    RAISE EXCEPTION 'bank_transactions.acting_for_account_id contém NULL. Execute backfill primeiro (migration 287)';
  END IF;
  IF EXISTS (SELECT 1 FROM bank_transactions WHERE authority_source IS NULL) THEN
    RAISE EXCEPTION 'bank_transactions.authority_source contém NULL. Execute backfill primeiro (migration 287)';
  END IF;
  IF EXISTS (SELECT 1 FROM bank_transactions WHERE permission_snapshot IS NULL) THEN
    RAISE EXCEPTION 'bank_transactions.permission_snapshot contém NULL. Execute backfill primeiro (migration 287)';
  END IF;
END $$;

-- Tornar campos NOT NULL
ALTER TABLE bank_transactions
  ALTER COLUMN acting_for_account_id SET NOT NULL,
  ALTER COLUMN authority_source SET NOT NULL,
  ALTER COLUMN permission_snapshot SET NOT NULL;

-- CHECK constraint: Se authority_source = 'system' → performed_by_user_id IS NULL
ALTER TABLE bank_transactions
  ADD CONSTRAINT chk_bank_transactions_system_user_id
  CHECK (
    (authority_source = 'system' AND performed_by_user_id IS NULL) OR
    (authority_source IN ('ownership', 'delegation', 'account_acl') AND performed_by_user_id IS NOT NULL)
  );

-- CHECK constraint: acting_for_account_id não pode ser NULL (já garantido por NOT NULL)
-- Removido: comparação com string vazia não faz sentido para UUID

-- ============================================================
-- TABELA: bank_ledger
-- ============================================================

-- Limpar dados inválidos ANTES de aplicar NOT NULL
-- Converter strings vazias e valores inválidos para NULL
UPDATE bank_ledger
SET 
  acting_for_account_id = NULLIF(acting_for_account_id::text, '')::uuid
WHERE acting_for_account_id::text = '' OR acting_for_account_id IS NULL;

UPDATE bank_ledger
SET 
  performed_by_user_id = NULLIF(performed_by_user_id::text, '')::uuid
WHERE performed_by_user_id::text = '' OR (performed_by_user_id IS NOT NULL AND performed_by_user_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

-- Garantir que não há NULLs antes de aplicar NOT NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM bank_ledger WHERE acting_for_account_id IS NULL) THEN
    RAISE EXCEPTION 'bank_ledger.acting_for_account_id contém NULL. Execute backfill primeiro (migration 287)';
  END IF;
  IF EXISTS (SELECT 1 FROM bank_ledger WHERE authority_source IS NULL) THEN
    RAISE EXCEPTION 'bank_ledger.authority_source contém NULL. Execute backfill primeiro (migration 287)';
  END IF;
  IF EXISTS (SELECT 1 FROM bank_ledger WHERE permission_snapshot IS NULL) THEN
    RAISE EXCEPTION 'bank_ledger.permission_snapshot contém NULL. Execute backfill primeiro (migration 287)';
  END IF;
END $$;

-- Tornar campos NOT NULL
ALTER TABLE bank_ledger
  ALTER COLUMN acting_for_account_id SET NOT NULL,
  ALTER COLUMN authority_source SET NOT NULL,
  ALTER COLUMN permission_snapshot SET NOT NULL;

-- CHECK constraint: Se authority_source = 'system' → performed_by_user_id IS NULL
ALTER TABLE bank_ledger
  ADD CONSTRAINT chk_bank_ledger_system_user_id
  CHECK (
    (authority_source = 'system' AND performed_by_user_id IS NULL) OR
    (authority_source IN ('ownership', 'delegation', 'account_acl') AND performed_by_user_id IS NOT NULL)
  );

-- CHECK constraint: acting_for_account_id não pode ser NULL (já garantido por NOT NULL)
-- Removido: comparação com string vazia não faz sentido para UUID

-- ============================================================
-- TABELA: bank_splits
-- ============================================================

-- Limpar dados inválidos ANTES de aplicar NOT NULL
-- Converter strings vazias e valores inválidos para NULL
UPDATE bank_splits
SET 
  acting_for_account_id = NULLIF(acting_for_account_id::text, '')::uuid
WHERE acting_for_account_id::text = '' OR acting_for_account_id IS NULL;

UPDATE bank_splits
SET 
  performed_by_user_id = NULLIF(performed_by_user_id::text, '')::uuid
WHERE performed_by_user_id::text = '' OR (performed_by_user_id IS NOT NULL AND performed_by_user_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

-- Garantir que não há NULLs antes de aplicar NOT NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM bank_splits WHERE acting_for_account_id IS NULL) THEN
    RAISE EXCEPTION 'bank_splits.acting_for_account_id contém NULL. Execute backfill primeiro (migration 287)';
  END IF;
  IF EXISTS (SELECT 1 FROM bank_splits WHERE authority_source IS NULL) THEN
    RAISE EXCEPTION 'bank_splits.authority_source contém NULL. Execute backfill primeiro (migration 287)';
  END IF;
  IF EXISTS (SELECT 1 FROM bank_splits WHERE permission_snapshot IS NULL) THEN
    RAISE EXCEPTION 'bank_splits.permission_snapshot contém NULL. Execute backfill primeiro (migration 287)';
  END IF;
END $$;

-- Tornar campos NOT NULL
ALTER TABLE bank_splits
  ALTER COLUMN acting_for_account_id SET NOT NULL,
  ALTER COLUMN authority_source SET NOT NULL,
  ALTER COLUMN permission_snapshot SET NOT NULL;

-- CHECK constraint: Se authority_source = 'system' → performed_by_user_id IS NULL
ALTER TABLE bank_splits
  ADD CONSTRAINT chk_bank_splits_system_user_id
  CHECK (
    (authority_source = 'system' AND performed_by_user_id IS NULL) OR
    (authority_source IN ('ownership', 'delegation', 'account_acl') AND performed_by_user_id IS NOT NULL)
  );

-- CHECK constraint: acting_for_account_id não pode ser NULL (já garantido por NOT NULL)
-- Removido: comparação com string vazia não faz sentido para UUID

-- ============================================================
-- COMENTÁRIOS
-- ============================================================

COMMENT ON CONSTRAINT chk_bank_transactions_system_user_id ON bank_transactions IS
  'Garante que operações do sistema (authority_source=system) não têm performed_by_user_id, e operações de usuário têm performed_by_user_id';

COMMENT ON CONSTRAINT chk_bank_ledger_system_user_id ON bank_ledger IS
  'Garante que operações do sistema (authority_source=system) não têm performed_by_user_id, e operações de usuário têm performed_by_user_id';

COMMENT ON CONSTRAINT chk_bank_splits_system_user_id ON bank_splits IS
  'Garante que operações do sistema (authority_source=system) não têm performed_by_user_id, e operações de usuário têm performed_by_user_id';

-- ============================================================
-- NOTA IMPORTANTE
-- ============================================================
-- Esta migration assume que:
-- 1. Todos os call sites foram atualizados para passar authorship (Fase 2 / Passo 1)
-- 2. Não existem mais registros com NULL nos campos que serão NOT NULL
-- 3. Se houver dados existentes, será necessário backfill antes de aplicar esta migration
--
-- ============================================================


