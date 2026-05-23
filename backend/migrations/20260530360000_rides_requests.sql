BEGIN;

CREATE TABLE IF NOT EXISTS rides_cities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'BR',
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rides_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  city_id UUID NOT NULL REFERENCES rides_cities(id),
  name TEXT NOT NULL,
  polygon JSONB NOT NULL,
  area_m2 NUMERIC(20,4),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rides_service_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  base_fare_cents BIGINT NOT NULL DEFAULT 0,
  price_per_km_cents BIGINT NOT NULL DEFAULT 0,
  price_per_min_cents BIGINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rides_ride_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  passenger_user_id UUID NOT NULL REFERENCES users(id),
  service_type_id UUID REFERENCES rides_service_types(id),
  origin JSONB NOT NULL,
  destination JSONB NOT NULL,
  stops JSONB NOT NULL DEFAULT '[]',
  stops_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','matching','accepted','cancelled','expired')),
  estimated_price_cents BIGINT,
  estimated_distance_m INTEGER,
  estimated_duration_s INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ride_requests_tenant ON rides_ride_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ride_requests_passenger ON rides_ride_requests(passenger_user_id);
CREATE INDEX IF NOT EXISTS idx_ride_requests_status ON rides_ride_requests(status);

CREATE TABLE IF NOT EXISTS rides_rides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  ride_request_id UUID NOT NULL REFERENCES rides_ride_requests(id),
  driver_id UUID NOT NULL REFERENCES rides_drivers(id),
  vehicle_id UUID NOT NULL REFERENCES rides_vehicles(id),
  passenger_user_id UUID NOT NULL REFERENCES users(id),
  service_type_id UUID REFERENCES rides_service_types(id),
  status TEXT NOT NULL DEFAULT 'accepted'
    CHECK (status IN ('accepted','driver_arriving','in_progress','completed','cancelled')),
  origin JSONB NOT NULL,
  destination JSONB NOT NULL,
  actual_distance_m INTEGER,
  actual_duration_s INTEGER,
  fare_cents BIGINT,
  driver_amount_cents BIGINT,
  platform_amount_cents BIGINT,
  fund_amount_cents BIGINT,
  bank_transaction_id UUID REFERENCES bank_transactions(id),
  metadata JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rides_rides_driver ON rides_rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_rides_passenger ON rides_rides(passenger_user_id);
CREATE INDEX IF NOT EXISTS idx_rides_rides_status ON rides_rides(status);

COMMIT;
