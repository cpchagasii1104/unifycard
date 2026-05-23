BEGIN;

CREATE TABLE IF NOT EXISTS rides_referral_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  referrer_user_id UUID NOT NULL REFERENCES users(id),
  code TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  total_earnings_cents BIGINT NOT NULL DEFAULT 0,
  total_referrals INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_referral_code UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS rides_referral_earnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  referral_link_id UUID NOT NULL REFERENCES rides_referral_links(id),
  ride_id UUID NOT NULL REFERENCES rides_rides(id),
  referrer_user_id UUID NOT NULL REFERENCES users(id),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  bank_transaction_id UUID REFERENCES bank_transactions(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_earnings_ride
  ON rides_referral_earnings(ride_id);
CREATE INDEX IF NOT EXISTS idx_referral_earnings_referrer
  ON rides_referral_earnings(tenant_id, referrer_user_id);

COMMIT;
