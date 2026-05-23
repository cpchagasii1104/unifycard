-- Idempotente: só actua se existir coluna legada amount (NUMERIC).
BEGIN;

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'b2b_payment_intents'
      AND column_name = 'amount'
  ) THEN
    ALTER TABLE b2b_payment_intents ADD COLUMN IF NOT EXISTS amount_cents BIGINT;
    UPDATE b2b_payment_intents
    SET amount_cents = GREATEST(1::bigint, ROUND((amount * 100)::numeric)::bigint)
    WHERE amount_cents IS NULL;
    ALTER TABLE b2b_payment_intents DROP COLUMN amount;
    ALTER TABLE b2b_payment_intents ALTER COLUMN amount_cents SET NOT NULL;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'b2b_payment_intents_amount_cents_pos'
    ) THEN
      ALTER TABLE b2b_payment_intents
        ADD CONSTRAINT b2b_payment_intents_amount_cents_pos CHECK (amount_cents > 0);
    END IF;
  END IF;
END
$migration$;

COMMIT;
