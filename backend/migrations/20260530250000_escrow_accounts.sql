BEGIN;

CREATE TABLE IF NOT EXISTS escrow_accounts (
  escrow_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  agreement_id UUID,
  buyer_actor_id UUID NOT NULL REFERENCES actors(id),
  seller_actor_id UUID NOT NULL REFERENCES actors(id),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','released','refunded','disputed','cancelled')),
  held_amount_cents BIGINT NOT NULL DEFAULT 0,
  bank_account_id UUID REFERENCES bank_accounts(id),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escrow_accounts_tenant ON escrow_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_escrow_accounts_buyer ON escrow_accounts(buyer_actor_id);
CREATE INDEX IF NOT EXISTS idx_escrow_accounts_seller ON escrow_accounts(seller_actor_id);

COMMIT;