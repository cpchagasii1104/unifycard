-- ============================================================
-- UNIFICARD - MIGRATION 287
-- CORE DE PERMISSÕES FINANCEIRAS — FASE 2 (PASSO 3/3)
-- Backfill seguro de dados legados (pré-FK)
-- ============================================================
--
-- OBJETIVO:
-- Preencher campos de autoria em registros legados antes de adicionar Foreign Keys.
-- Esta migration é executada ANTES da migration 288 (Foreign Keys).
--
-- REGRAS:
-- - Não inventar dados
-- - Apenas preencher quando determinístico
-- - Registros sem dados suficientes permanecem NULL (será tratado na migration 288)
--
-- ============================================================

-- ============================================================
-- PARTE 1: BACKFILL DE permission_snapshot
-- ============================================================

-- bank_transactions
UPDATE bank_transactions
SET permission_snapshot = jsonb_build_object(
  'permissionKey', 'legacy',
  'allowed', true,
  'reason', 'Backfill legacy record',
  'actorId', COALESCE(acting_for_actor_id::text, 'system'),
  'userId', COALESCE(performed_by_user_id::text, 'system'),
  'decidedAt', NOW()::text
)
WHERE permission_snapshot IS NULL;

-- bank_ledger
UPDATE bank_ledger
SET permission_snapshot = jsonb_build_object(
  'permissionKey', 'legacy',
  'allowed', true,
  'reason', 'Backfill legacy record',
  'actorId', COALESCE(acting_for_actor_id::text, 'system'),
  'userId', COALESCE(performed_by_user_id::text, 'system'),
  'decidedAt', NOW()::text
)
WHERE permission_snapshot IS NULL;

-- bank_splits
UPDATE bank_splits
SET permission_snapshot = jsonb_build_object(
  'permissionKey', 'legacy',
  'allowed', true,
  'reason', 'Backfill legacy record',
  'actorId', COALESCE(acting_for_actor_id::text, 'system'),
  'userId', COALESCE(performed_by_user_id::text, 'system'),
  'decidedAt', NOW()::text
)
WHERE permission_snapshot IS NULL;

-- ============================================================
-- PARTE 2: BACKFILL DE authority_source
-- ============================================================

-- bank_transactions
UPDATE bank_transactions
SET authority_source = CASE
  WHEN performed_by_user_id IS NULL THEN 'system'
  ELSE 'ownership'
END
WHERE authority_source IS NULL OR authority_source NOT IN ('ownership', 'delegation', 'account_acl', 'system');

-- bank_ledger
UPDATE bank_ledger
SET authority_source = CASE
  WHEN performed_by_user_id IS NULL THEN 'system'
  ELSE 'ownership'
END
WHERE authority_source IS NULL OR authority_source NOT IN ('ownership', 'delegation', 'account_acl', 'system');

-- bank_splits
UPDATE bank_splits
SET authority_source = CASE
  WHEN performed_by_user_id IS NULL THEN 'system'
  ELSE 'ownership'
END
WHERE authority_source IS NULL OR authority_source NOT IN ('ownership', 'delegation', 'account_acl', 'system');

-- ============================================================
-- PARTE 3: BACKFILL DE acting_for_account_id
-- ============================================================

-- bank_transactions: usar from_account_id quando disponível
UPDATE bank_transactions
SET acting_for_account_id = from_account_id
WHERE acting_for_account_id IS NULL
  AND from_account_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM bank_accounts
    WHERE account_id = bank_transactions.from_account_id
  );

-- bank_transactions: usar to_account_id como fallback se from_account_id não disponível
UPDATE bank_transactions
SET acting_for_account_id = to_account_id
WHERE acting_for_account_id IS NULL
  AND to_account_id IS NOT NULL
  AND from_account_id IS NULL
  AND EXISTS (
    SELECT 1 FROM bank_accounts
    WHERE account_id = bank_transactions.to_account_id
  );

-- bank_ledger: usar account_id
UPDATE bank_ledger
SET acting_for_account_id = account_id
WHERE acting_for_account_id IS NULL
  AND account_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM bank_accounts
    WHERE account_id = bank_ledger.account_id
  );

-- bank_splits: usar target_account_id
UPDATE bank_splits
SET acting_for_account_id = target_account_id
WHERE acting_for_account_id IS NULL
  AND target_account_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM bank_accounts
    WHERE account_id = bank_splits.target_account_id
  );

-- ============================================================
-- PARTE 4: BACKFILL DE acting_for_actor_id (quando determinístico)
-- ============================================================

-- bank_transactions: inferir actor_id a partir de from_account_id
UPDATE bank_transactions
SET acting_for_actor_id = (
  SELECT a.actor_id
  FROM bank_accounts ba
  JOIN actors a ON (
    (ba.owner_type = 'user' AND a.actor_type = 'user' AND a.user_id = ba.owner_id) OR
    (ba.owner_type = 'company' AND a.actor_type = 'page' AND a.company_id = ba.owner_id)
  )
  WHERE ba.account_id = bank_transactions.acting_for_account_id
  LIMIT 1
)
WHERE acting_for_actor_id IS NULL
  AND acting_for_account_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM bank_accounts
    WHERE account_id = bank_transactions.acting_for_account_id
      AND owner_type IN ('user', 'company')
  );

-- bank_ledger: inferir actor_id a partir de account_id
UPDATE bank_ledger
SET acting_for_actor_id = (
  SELECT a.actor_id
  FROM bank_accounts ba
  JOIN actors a ON (
    (ba.owner_type = 'user' AND a.actor_type = 'user' AND a.user_id = ba.owner_id) OR
    (ba.owner_type = 'company' AND a.actor_type = 'page' AND a.company_id = ba.owner_id)
  )
  WHERE ba.account_id = bank_ledger.acting_for_account_id
  LIMIT 1
)
WHERE acting_for_actor_id IS NULL
  AND acting_for_account_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM bank_accounts
    WHERE account_id = bank_ledger.acting_for_account_id
      AND owner_type IN ('user', 'company')
  );

-- bank_splits: inferir actor_id a partir de target_account_id
UPDATE bank_splits
SET acting_for_actor_id = (
  SELECT a.actor_id
  FROM bank_accounts ba
  JOIN actors a ON (
    (ba.owner_type = 'user' AND a.actor_type = 'user' AND a.user_id = ba.owner_id) OR
    (ba.owner_type = 'company' AND a.actor_type = 'page' AND a.company_id = ba.owner_id)
  )
  WHERE ba.account_id = bank_splits.acting_for_account_id
  LIMIT 1
)
WHERE acting_for_actor_id IS NULL
  AND acting_for_account_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM bank_accounts
    WHERE account_id = bank_splits.acting_for_account_id
      AND owner_type IN ('user', 'company')
  );

-- ============================================================
-- RELATÓRIO DE BACKFILL
-- ============================================================

-- Contar registros que ainda têm NULL após backfill
DO $$
DECLARE
  transactions_null_count INTEGER;
  ledger_null_count INTEGER;
  splits_null_count INTEGER;
  transactions_actor_null_count INTEGER;
  ledger_actor_null_count INTEGER;
  splits_actor_null_count INTEGER;
BEGIN
  -- Contar acting_for_account_id NULL
  SELECT COUNT(*) INTO transactions_null_count
  FROM bank_transactions
  WHERE acting_for_account_id IS NULL;
  
  SELECT COUNT(*) INTO ledger_null_count
  FROM bank_ledger
  WHERE acting_for_account_id IS NULL;
  
  SELECT COUNT(*) INTO splits_null_count
  FROM bank_splits
  WHERE acting_for_account_id IS NULL;
  
  -- Contar acting_for_actor_id NULL
  SELECT COUNT(*) INTO transactions_actor_null_count
  FROM bank_transactions
  WHERE acting_for_actor_id IS NULL;
  
  SELECT COUNT(*) INTO ledger_actor_null_count
  FROM bank_ledger
  WHERE acting_for_actor_id IS NULL;
  
  SELECT COUNT(*) INTO splits_actor_null_count
  FROM bank_splits
  WHERE acting_for_actor_id IS NULL;
  
  -- Log do relatório
  RAISE NOTICE 'Backfill concluído:';
  RAISE NOTICE '  bank_transactions com acting_for_account_id NULL: %', transactions_null_count;
  RAISE NOTICE '  bank_ledger com acting_for_account_id NULL: %', ledger_null_count;
  RAISE NOTICE '  bank_splits com acting_for_account_id NULL: %', splits_null_count;
  RAISE NOTICE '  bank_transactions com acting_for_actor_id NULL: %', transactions_actor_null_count;
  RAISE NOTICE '  bank_ledger com acting_for_actor_id NULL: %', ledger_actor_null_count;
  RAISE NOTICE '  bank_splits com acting_for_actor_id NULL: %', splits_actor_null_count;
END $$;

-- ============================================================
-- NOTA IMPORTANTE
-- ============================================================
-- Registros que permanecem com NULL após este backfill:
-- - Contas de sistema (owner_type='system') não têm actor_id correspondente
-- - Registros órfãos (account_id não existe em bank_accounts)
-- Estes casos são esperados e não bloqueiam a próxima migration (FK)
--
-- ============================================================


