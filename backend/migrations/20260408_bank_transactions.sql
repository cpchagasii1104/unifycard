-- Bank fase 2 — ligação B2B → ledger canónico (0003 + 0025).
-- NÃO cria tabela bank_transactions duplicada: SSOT permanece bank_transactions / bank_ledger.
-- external_reference do desenho = reference_type + reference_id em bank_transactions (uniq por tenant).

BEGIN;

-- Status "completed" no intent: pago com sucesso no Bank (ledger); sem saldo em B2B.
ALTER TABLE b2b_payment_intents
  DROP CONSTRAINT IF EXISTS b2b_payment_intents_status_check;

ALTER TABLE b2b_payment_intents
  ADD CONSTRAINT b2b_payment_intents_status_check
  CHECK (status IN ('pending', 'ready', 'cancelled', 'completed'));

ALTER TABLE b2b_payment_intents
  ADD COLUMN IF NOT EXISTS bank_transaction_id UUID REFERENCES bank_transactions (id);

CREATE INDEX IF NOT EXISTS idx_b2b_payment_intents_bank_transaction_id
  ON b2b_payment_intents (bank_transaction_id)
  WHERE bank_transaction_id IS NOT NULL;

COMMENT ON COLUMN b2b_payment_intents.bank_transaction_id IS
  'FK para bank_transactions após débito/crédito no ledger; 1 intent → 1 transação; preenchido só após sucesso.';

COMMIT;
