-- 0011_add_financial_idempotency.sql
-- Idempotência obrigatória para operações financeiras

ALTER TABLE bank_transactions
ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);

ALTER TABLE payment_intents
ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);

-- Índices únicos
CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_transactions_idempotency
ON bank_transactions (idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_intents_idempotency
ON payment_intents (idempotency_key)
WHERE idempotency_key IS NOT NULL;
