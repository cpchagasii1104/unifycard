-- ============================================================
-- 0008: trace_id — correlação intent → transaction → pix → bank
-- ============================================================
-- Opção A: UUID gerado na origem (intent), imutável; replica-se em payment_transactions.

BEGIN;

ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS trace_id UUID DEFAULT gen_random_uuid();

UPDATE payment_intents
SET trace_id = gen_random_uuid()
WHERE trace_id IS NULL;

ALTER TABLE payment_intents
  ALTER COLUMN trace_id SET NOT NULL,
  ALTER COLUMN trace_id SET DEFAULT gen_random_uuid();

ALTER TABLE payment_transactions
  ADD COLUMN IF NOT EXISTS trace_id UUID;

UPDATE payment_transactions pt
SET trace_id = pi.trace_id
FROM payment_intents pi
WHERE pt.payment_intent_id = pi.id
  AND pt.trace_id IS NULL;

UPDATE payment_transactions
SET trace_id = gen_random_uuid()
WHERE trace_id IS NULL;

ALTER TABLE payment_transactions
  ALTER COLUMN trace_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_trace_id
  ON payment_transactions(tenant_id, trace_id);

CREATE INDEX IF NOT EXISTS idx_payment_intents_trace_id
  ON payment_intents(tenant_id, trace_id);

COMMIT;
