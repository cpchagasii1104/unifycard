-- =========================================================
-- 012_rides_part4_pricing.sql
-- =========================================================

CREATE TABLE rides_service_types (
  service_type_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL,
  name            VARCHAR(80) NOT NULL,
  description     TEXT,
  icon            TEXT,
  capacity        INTEGER DEFAULT 4,

  base_price      NUMERIC(10,2) DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,

  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, name)
);

ALTER TABLE rides_service_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_service_types_rls
  ON rides_service_types
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- =========================================================
-- PRICING BASE
-- =========================================================

CREATE TABLE rides_pricing_config (
  pricing_config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL,
  city_id           UUID NOT NULL REFERENCES rides_cities(city_id),

  base_fare         NUMERIC(10,2) NOT NULL,
  per_km            NUMERIC(10,2) NOT NULL,
  per_minute        NUMERIC(10,2) NOT NULL,

  night_multiplier  NUMERIC(5,2),
  rain_multiplier   NUMERIC(5,2),

  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, city_id)
);

ALTER TABLE rides_pricing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_pricing_config_rls
  ON rides_pricing_config
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE TRIGGER trg_rides_pricing_config_updated_at
  BEFORE UPDATE ON rides_pricing_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- DEMAND PRESSURE
-- =========================================================

CREATE TABLE rides_zone_demand_pressure (
  pressure_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL,
  zone_id         UUID NOT NULL REFERENCES rides_zones(zone_id),

  active_requests INTEGER DEFAULT 0,
  available_drivers INTEGER DEFAULT 0,

  pressure        NUMERIC(10,2),

  calculated_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rides_zone_demand_pressure ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_zone_demand_pressure_rls
  ON rides_zone_demand_pressure
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- =========================================================
-- INCENTIVOS DINÂMICOS
-- =========================================================

CREATE TABLE rides_zone_incentives (
  incentive_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL,
  zone_id         UUID NOT NULL REFERENCES rides_zones(zone_id),

  incentive_type  VARCHAR(30), -- per_km | per_ride | bonus
  incentive_value NUMERIC(10,2),

  reason          VARCHAR(50),

  starts_at       TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  is_active       BOOLEAN DEFAULT TRUE,

  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rides_zone_incentives ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_zone_incentives_rls
  ON rides_zone_incentives
  USING (tenant_id::text = current_setting('app.current_tenant', true));
