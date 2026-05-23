-- Prompt 52: coluna opcional para comparar saldo derivado do ledger (não é SSOT; NULL = ignorar account_mismatch).

BEGIN;

ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS reconciliation_balance_cents BIGINT;

COMMENT ON COLUMN bank_accounts.reconciliation_balance_cents IS
  'Referência para reconciliação vs Σ ledger por conta; NULL = motor não emite account_mismatch para esta conta.';

COMMIT;
