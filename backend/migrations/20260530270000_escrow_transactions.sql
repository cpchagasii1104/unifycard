BEGIN;

CREATE TABLE IF NOT EXISTS escrow_transactions (
  transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escrow_id UUID NOT NULL REFERENCES escrow_accounts(escrow_id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  milestone_id UUID REFERENCES payment_milestones(milestone_id),
  transaction_type TEXT NOT NULL
    CHECK (transaction_type IN ('hold','release','refund')),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','completed','failed')),
  bank_transaction_id UUID REFERENCES bank_transactions(id),
  reference_type TEXT,
  reference_id UUID,
  idempotency_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_escrow_transactions_idempotency
  ON escrow_transactions(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_escrow_transactions_escrow
  ON escrow_transactions(escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_bank
  ON escrow_transactions(bank_transaction_id)
  WHERE bank_transaction_id IS NOT NULL;

COMMIT;