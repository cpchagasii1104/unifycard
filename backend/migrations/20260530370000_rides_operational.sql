BEGIN;

CREATE TABLE IF NOT EXISTS rides_driver_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  driver_id UUID NOT NULL REFERENCES rides_drivers(id),
  location JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_driver_location UNIQUE (tenant_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_driver_locations_tenant ON rides_driver_locations(tenant_id);

CREATE TABLE IF NOT EXISTS rides_driver_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  driver_id UUID NOT NULL REFERENCES rides_drivers(id),
  is_online BOOLEAN NOT NULL DEFAULT true,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_driver_sessions_driver ON rides_driver_sessions(driver_id);

CREATE TABLE IF NOT EXISTS rides_pricing_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  service_type_id UUID NOT NULL REFERENCES rides_service_types(id),
  base_fare_cents BIGINT NOT NULL DEFAULT 0,
  price_per_km_cents BIGINT NOT NULL DEFAULT 0,
  price_per_min_cents BIGINT NOT NULL DEFAULT 0,
  minimum_fare_cents BIGINT NOT NULL DEFAULT 0,
  surge_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
