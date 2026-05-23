-- ============================================================
-- 0007: payment_transactions (estado interno de execução)
-- ============================================================
-- 1 intent → 1 linha (UNIQUE tenant_id + payment_intent_id).
-- SSOT de valor continua em payment_intents; aqui: status + refs bank/provider.

BEGIN;

CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payment_intent_id UUID NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
  provider TEXT,
  provider_reference TEXT,
  bank_transaction_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payment_transactions_one_per_intent UNIQUE (tenant_id, payment_intent_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_tenant_intent
  ON payment_transactions(tenant_id, payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_status_created
  ON payment_transactions(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_idempotency
  ON payment_transactions(tenant_id, payment_intent_id, ((metadata->>'idempotency_key')));

COMMIT;
