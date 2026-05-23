BEGIN;

CREATE TABLE IF NOT EXISTS rides_distribution_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  service_type_id UUID REFERENCES rides_service_types(id),
  driver_percentage NUMERIC(5,4) NOT NULL DEFAULT 0.70,
  platform_percentage NUMERIC(5,4) NOT NULL DEFAULT 0.03,
  regional_fund_percentage NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  group_percentage NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  referral_percentage NUMERIC(5,4) NOT NULL DEFAULT 0.07,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_percentages_sum CHECK (
    driver_percentage + platform_percentage +
    regional_fund_percentage + group_percentage +
    referral_percentage <= 1.0001
  )
);

CREATE TABLE IF NOT EXISTS rides_ride_distributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  ride_id UUID NOT NULL REFERENCES rides_rides(id),
  total_amount_cents BIGINT NOT NULL DEFAULT 0,
  driver_amount_cents BIGINT NOT NULL DEFAULT 0,
  platform_amount_cents BIGINT NOT NULL DEFAULT 0,
  community_amount_cents BIGINT NOT NULL DEFAULT 0,
  regional_fund_amount_cents BIGINT NOT NULL DEFAULT 0,
  group_amount_cents BIGINT NOT NULL DEFAULT 0,
  referral_amount_cents BIGINT NOT NULL DEFAULT 0,
  bank_transaction_id UUID REFERENCES bank_transactions(id),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ride_distributions_ride
  ON rides_ride_distributions(ride_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ride_distributions_ride
  ON rides_ride_distributions(tenant_id, ride_id);

COMMIT;