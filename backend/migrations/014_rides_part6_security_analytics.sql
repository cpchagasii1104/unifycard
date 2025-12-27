-- =========================================================
-- 014_rides_part6_security_analytics.sql
-- =========================================================

-- =========================================================
-- EMERGENCY CONTACTS
-- =========================================================

CREATE TABLE rides_emergency_contacts (
  emergency_contact_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID NOT NULL,
  user_id              UUID NOT NULL REFERENCES users(user_id),

  name                 VARCHAR(150) NOT NULL,
  phone                VARCHAR(50) NOT NULL,

  created_at           TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rides_emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_emergency_contacts_rls
  ON rides_emergency_contacts
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- =========================================================
-- RIDE SHARES (compartilhamento de rota)
-- =========================================================

CREATE TABLE rides_ride_shares (
  ride_share_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL,
  ride_id        UUID NOT NULL REFERENCES rides_rides(ride_id),
  shared_with    UUID NOT NULL REFERENCES users(user_id),
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rides_ride_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_ride_shares_rls
  ON rides_ride_shares
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- =========================================================
-- DISPUTES
-- =========================================================

CREATE TABLE rides_disputes (
  dispute_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL,
  ride_id        UUID NOT NULL REFERENCES rides_rides(ride_id),

  opened_by      UUID REFERENCES users(user_id),
  status         VARCHAR(40) DEFAULT 'open',
  reason         TEXT,
  resolution     TEXT,

  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rides_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_disputes_rls
  ON rides_disputes
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE TRIGGER trg_rides_disputes_updated_at
  BEFORE UPDATE ON rides_disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- DRIVER EARNINGS HISTORY
-- =========================================================

CREATE TABLE rides_driver_earnings_history (
  earnings_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL,
  driver_id      UUID NOT NULL REFERENCES rides_drivers(driver_id),

  ride_id        UUID REFERENCES rides_rides(ride_id),
  amount         NUMERIC(10,2) NOT NULL,

  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rides_driver_earnings_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_driver_earnings_history_rls
  ON rides_driver_earnings_history
  USING (tenant_id::text = current_setting('app.current_tenant', true));
