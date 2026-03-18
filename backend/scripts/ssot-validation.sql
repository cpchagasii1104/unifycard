-- ============================================================
-- SSOT VALIDATION QUERY
-- Executar contra base já migrada (Genesis aplicado).
-- Uso: psql -f backend/scripts/ssot-validation.sql
-- ============================================================

-- 1. Nenhum ledger paralelo
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE '%ledger%'
      AND table_name NOT IN ('bank_ledger', 'coverage_audit_log')
  ) THEN
    RAISE EXCEPTION 'FAIL: Ledger paralelo existe';
  END IF;
END $$;

-- 2. Nenhum split paralelo
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE '%split%'
      AND table_name != 'bank_splits'
  ) THEN
    RAISE EXCEPTION 'FAIL: Split paralelo existe';
  END IF;
END $$;

-- 3. Todas as transações têm purpose
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bank_transactions'
  ) AND EXISTS (
    SELECT 1 FROM bank_transactions WHERE purpose IS NULL
  ) THEN
    RAISE EXCEPTION 'FAIL: Transação sem purpose';
  END IF;
END $$;

-- 4. Coverage dentro do limite (se view existir)
DO $$
DECLARE
  v_max_coverage NUMERIC;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'system_coverage'
  ) THEN
    SELECT MAX(
      CASE WHEN execution_capacity_cents > 0
      THEN (total_credits_cents::NUMERIC / execution_capacity_cents::NUMERIC) * 100
      ELSE 0 END
    ) INTO v_max_coverage
    FROM system_coverage;

    IF v_max_coverage IS NOT NULL AND v_max_coverage >= 80 THEN
      RAISE EXCEPTION 'FAIL: Coverage acima de 80%%: %', v_max_coverage;
    END IF;
  END IF;
END $$;

SELECT 'PASS: SSOT verified' AS result;
