BEGIN;

ALTER TABLE bank_transactions
ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_bank_transactions_order_id
ON bank_transactions(order_id)
WHERE order_id IS NOT NULL;

COMMIT;
