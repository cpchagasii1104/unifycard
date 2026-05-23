-- Bank fase 1 — preço em centavos na linha + payment_intent (sem ledger).
BEGIN;

ALTER TABLE b2b_order_items
  ADD COLUMN IF NOT EXISTS unit_price_cents BIGINT,
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3);

UPDATE b2b_order_items
SET
  unit_price_cents = COALESCE(unit_price_cents, 0),
  currency = COALESCE(NULLIF(TRIM(currency), ''), 'BRL')
WHERE unit_price_cents IS NULL OR currency IS NULL;

ALTER TABLE b2b_order_items
  ALTER COLUMN unit_price_cents SET NOT NULL,
  ALTER COLUMN currency SET NOT NULL;

ALTER TABLE b2b_order_items
  DROP CONSTRAINT IF EXISTS b2b_order_items_unit_price_cents_nonneg;

ALTER TABLE b2b_order_items
  ADD CONSTRAINT b2b_order_items_unit_price_cents_nonneg CHECK (unit_price_cents >= 0);

COMMENT ON COLUMN b2b_order_items.unit_price_cents IS
  'Preço unitário em centavos (snapshot na linha).';
COMMENT ON COLUMN b2b_order_items.currency IS
  'ISO 4217.';

CREATE TABLE IF NOT EXISTS b2b_payment_intents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
  b2b_order_id UUID NOT NULL REFERENCES b2b_orders (id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  currency VARCHAR(3) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ready', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now ()
);

CREATE INDEX IF NOT EXISTS idx_b2b_payment_intents_order ON b2b_payment_intents (b2b_order_id, created_at DESC);

COMMENT ON TABLE b2b_payment_intents IS
  'Bank fase 1: intenção de pagamento em centavos. Sem ledger.';

COMMIT;
