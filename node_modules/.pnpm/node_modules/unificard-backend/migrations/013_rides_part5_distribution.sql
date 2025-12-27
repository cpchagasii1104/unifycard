-- =========================================================
-- 013_rides_part5_distribution.sql
-- =========================================================

CREATE TABLE rides_distribution_rules (
  rule_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL,

  name            VARCHAR(150),
  percentage_driver      NUMERIC(5,2),
  percentage_platform    NUMERIC(5,2),
  percentage_fund        NUMERIC(5,2),
  percentage_referral    NUMERIC(5,2),

  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rides_distribution_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_distribution_rules_rls
  ON rides_distribution_rules
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- =========================================================
-- DISTRIBUIÇÃO POR CORRIDA
-- =========================================================

CREATE TABLE rides_ride_distributions (
  ride_distribution_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID NOT NULL,

  ride_id              UUID NOT NULL REFERENCES rides_rides(ride_id),

  driver_amount        NUMERIC(10,2),
  platform_amount      NUMERIC(10,2),
  fund_amount          NUMERIC(10,2),
  referral_amount      NUMERIC(10,2),

  rule_snapshot        JSONB,

  created_at           TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rides_ride_distributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_ride_distributions_rls
  ON rides_ride_distributions
  USING (tenant_id::text = current_setting('app.current_tenant', true));
