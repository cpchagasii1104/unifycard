-- =========================================================
-- 011_rides_part3_ride_lifecycle.sql
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- =========================================================
-- RIDE REQUESTS
-- =========================================================

CREATE TABLE rides_ride_requests (
  request_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL,

  passenger_id    UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  origin          GEOGRAPHY(POINT) NOT NULL,
  destination     GEOGRAPHY(POINT) NOT NULL,

  -- Novo requisito Clayton
  passenger_count INTEGER NOT NULL DEFAULT 1,

  stops           JSONB DEFAULT '[]',
  stops_count     INTEGER GENERATED ALWAYS AS (jsonb_array_length(stops)) STORED,

  service_type_id UUID NOT NULL,

  estimated_distance_km NUMERIC(10,2),
  estimated_duration_min INTEGER,

  status          VARCHAR(40) NOT NULL DEFAULT 'pending',

  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rides_ride_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_ride_requests_rls
  ON rides_ride_requests
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE TRIGGER trg_rides_ride_requests_updated_at
  BEFORE UPDATE ON rides_ride_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- RIDE OFFERS
-- =========================================================

CREATE TABLE rides_request_offers (
  offer_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL,
  request_id    UUID NOT NULL REFERENCES rides_ride_requests(request_id) ON DELETE CASCADE,
  driver_id     UUID NOT NULL REFERENCES rides_drivers(driver_id) ON DELETE CASCADE,

  status        VARCHAR(30) NOT NULL DEFAULT 'pending',

  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rides_request_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_request_offers_rls
  ON rides_request_offers
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- =========================================================
-- RIDES (corridas)
-- =========================================================

CREATE TABLE rides_rides (
  ride_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL,

  request_id     UUID NOT NULL REFERENCES rides_ride_requests(request_id) ON DELETE CASCADE,
  driver_id      UUID NOT NULL REFERENCES rides_drivers(driver_id) ON DELETE CASCADE,
  vehicle_id     UUID NOT NULL REFERENCES rides_vehicles(vehicle_id),

  status         VARCHAR(40) NOT NULL DEFAULT 'assigned',

  accepted_at    TIMESTAMPTZ,
  arrived_at     TIMESTAMPTZ,
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  cancelled_at   TIMESTAMPTZ,

  total_distance_km NUMERIC(10,2),
  total_duration_min INTEGER,

  final_price        NUMERIC(10,2),

  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rides_rides ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_rides_rls
  ON rides_rides
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE TRIGGER trg_rides_rides_updated_at
  BEFORE UPDATE ON rides_rides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- RIDE LOCATION TRACKING
-- =========================================================

CREATE TABLE rides_ride_locations (
  ride_location_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL,
  ride_id          UUID NOT NULL REFERENCES rides_rides(ride_id) ON DELETE CASCADE,

  location         GEOGRAPHY(POINT) NOT NULL,
  speed_kmh        NUMERIC(10,2),
  heading          INT,
  recorded_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rides_ride_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_ride_locations_rls
  ON rides_ride_locations
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- =========================================================
-- RIDE EVENTS (log interno)
-- =========================================================

CREATE TABLE rides_ride_events (
  event_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL,
  ride_id       UUID NOT NULL REFERENCES rides_rides(ride_id),

  event_type    VARCHAR(100) NOT NULL,
  payload       JSONB DEFAULT '{}',

  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rides_ride_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_ride_events_rls
  ON rides_ride_events
  USING (tenant_id::text = current_setting('app.current_tenant', true));
