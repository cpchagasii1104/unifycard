-- INFRA-4 / INFRA-4.1 — Expande order_sagas (timeout, passos, tentativas) + ledger_compensations (compensação por nova transação).

BEGIN;

-- Renomear state → status (alinhado ao contrato INFRA-4)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_sagas' AND column_name = 'state'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_sagas' AND column_name = 'status'
  ) THEN
    ALTER TABLE order_sagas RENAME COLUMN state TO status;
  END IF;
END $$;

ALTER TABLE order_sagas
  ADD COLUMN IF NOT EXISTS current_step TEXT NOT NULL DEFAULT 'order_created',
  ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts INT NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS timeout_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE order_sagas
SET payload = metadata
WHERE payload = '{}'::jsonb
  AND metadata IS NOT NULL
  AND metadata <> '{}'::jsonb
  AND jsonb_typeof(metadata) = 'object';

DROP INDEX IF EXISTS idx_order_sagas_tenant_state;

CREATE INDEX IF NOT EXISTS idx_order_sagas_tenant_status
  ON order_sagas (tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_sagas_timeout_due
  ON order_sagas (timeout_at)
  WHERE timeout_at IS NOT NULL
    AND status NOT IN ('fulfilled', 'failed', 'cancelled');

COMMENT ON TABLE order_sagas IS
  'Máquina de estados da saga pedido → pagamento → fulfillment → ledger (INFRA-4). Estado persistido; eventos via outbox.';

CREATE TABLE IF NOT EXISTS ledger_compensations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  original_transaction_id UUID NOT NULL REFERENCES bank_transactions(id) ON DELETE RESTRICT,
  compensation_transaction_id UUID NOT NULL REFERENCES bank_transactions(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, original_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_ledger_compensations_tenant_created
  ON ledger_compensations (tenant_id, created_at DESC);

COMMENT ON TABLE ledger_compensations IS
  'INFRA-4.1: compensação = nova transação inversa; ledger original imutável; uma compensação por transação origem.';

COMMIT;
