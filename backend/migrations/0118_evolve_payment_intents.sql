BEGIN;

ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS order_id UUID,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'BRL';

ALTER TABLE payment_intents
  ADD CONSTRAINT fk_payment_intents_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE payment_intents DROP CONSTRAINT IF EXISTS payment_intents_status_check;
ALTER TABLE payment_intents ADD CONSTRAINT payment_intents_status_check
  CHECK (status IN (
    'CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'SETTLED',
    'FAILED', 'CANCELLED', 'REVERSED',
    'pending', 'processing', 'completed', 'failed', 'cancelled'
  ));

CREATE INDEX IF NOT EXISTS idx_payment_intents_order
  ON payment_intents (order_id)
  WHERE order_id IS NOT NULL;

COMMENT ON COLUMN payment_intents.order_id IS 'FK para orders. Nulo para intents legados sem pedido estruturado.';
COMMENT ON COLUMN payment_intents.currency IS 'Moeda (ISO 4217). Default BRL.';

COMMIT;
