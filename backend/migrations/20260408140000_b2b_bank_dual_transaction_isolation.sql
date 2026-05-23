-- B2B Bank: isolamento por tenant — cada bank_transaction só tem lançamentos no seu tenant.
-- Liga o par débito/crédito via reference_group_id (UUID estável = intent.id).

BEGIN;

ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS reference_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_bank_transactions_reference_group_id
  ON bank_transactions (reference_group_id)
  WHERE reference_group_id IS NOT NULL;

COMMENT ON COLUMN bank_transactions.reference_group_id IS
  'Agrupa pernas da mesma liquidação (ex.: B2B: débito comprador + crédito fornecedor).';

ALTER TABLE b2b_payment_intents
  ADD COLUMN IF NOT EXISTS bank_transaction_supplier_id UUID REFERENCES bank_transactions (id);

CREATE INDEX IF NOT EXISTS idx_b2b_payment_intents_bank_tx_supplier
  ON b2b_payment_intents (bank_transaction_supplier_id)
  WHERE bank_transaction_supplier_id IS NOT NULL;

COMMENT ON COLUMN b2b_payment_intents.bank_transaction_id IS
  'Transação bank no tenant comprador (débito); par em bank_transaction_supplier_id.';
COMMENT ON COLUMN b2b_payment_intents.bank_transaction_supplier_id IS
  'Transação bank no tenant fornecedor (crédito); mesmo reference_group_id que o débito.';

COMMIT;
