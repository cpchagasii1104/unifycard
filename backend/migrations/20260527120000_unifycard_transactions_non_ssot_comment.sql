-- Reforço normativo Gate 2: unifycard_transactions é log pré-financeiro, não SSOT de liquidação.
-- Não altera schema; apenas COMMENT (idempotente).

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.unifycard_transactions') IS NOT NULL THEN
    COMMENT ON TABLE unifycard_transactions IS
      'LOG ONLY — NON-SSOT — correlação operacional com bank_transaction_id; '
      'NÃO usar para decisão de saldo, compensação nem substituir bank_ledger / bank_transactions (Gate 2).';
  END IF;
END $$;

COMMIT;
