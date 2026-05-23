BEGIN;

CREATE TABLE IF NOT EXISTS payment_milestones (
  milestone_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escrow_id UUID NOT NULL REFERENCES escrow_accounts(escrow_id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  description TEXT,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','authorized','released','refunded','failed')),
  released_at TIMESTAMPTZ,
  bank_transaction_id UUID REFERENCES bank_transactions(id),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_milestones_escrow ON payment_milestones(escrow_id);
CREATE INDEX IF NOT EXISTS idx_milestones_tenant ON payment_milestones(tenant_id);

COMMIT;