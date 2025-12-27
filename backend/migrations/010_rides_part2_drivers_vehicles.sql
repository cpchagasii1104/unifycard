-- =========================================================
-- 010_rides_part2_drivers_vehicles.sql
-- Estruturas: drivers, vehicles, availability, driver_services,
--             driver_locations, driver_sessions
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- =========================================================
-- DRIVERS
-- =========================================================

CREATE TABLE rides_drivers (
  driver_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL,
  user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  is_active     BOOLEAN DEFAULT TRUE,
  is_verified   BOOLEAN DEFAULT FALSE,

  rating_avg    NUMERIC(2,2),
  rating_count  INTEGER DEFAULT 0,

  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, user_id)
);

ALTER TABLE rides_drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_drivers_rls
  ON rides_drivers
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE TRIGGER trg_rides_drivers_updated_at
  BEFORE UPDATE ON rides_drivers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- VEHICLES
-- =========================================================

CREATE TABLE rides_vehicles (
  vehicle_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL,

  driver_id     UUID NOT NULL REFERENCES rides_drivers(driver_id) ON DELETE CASCADE,

  brand         VARCHAR(100),
  model         VARCHAR(100),
  year          INT,
  plate         VARCHAR(20) NOT NULL,

  color         VARCHAR(50),
  type          VARCHAR(50),     -- carro, moto, van, guincho, etc.

  capacity      INT DEFAULT 4,

  is_active     BOOLEAN DEFAULT TRUE,

  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, plate)
);

ALTER TABLE rides_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_vehicles_rls
  ON rides_vehicles
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE TRIGGER trg_rides_vehicles_updated_at
  BEFORE UPDATE ON rides_vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- DRIVER SERVICES (tipos de serviço)
-- =========================================================

CREATE TABLE rides_driver_services (
  driver_service_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL,
  driver_id         UUID NOT NULL REFERENCES rides_drivers(driver_id) ON DELETE CASCADE,
  service_type_id   UUID NOT NULL,

  is_enabled        BOOLEAN DEFAULT TRUE,

  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, driver_id, service_type_id)
);

ALTER TABLE rides_driver_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_driver_services_rls
  ON rides_driver_services
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE TRIGGER trg_rides_driver_services_updated_at
  BEFORE UPDATE ON rides_driver_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- DRIVER LOCATIONS (tempo real)
-- =========================================================

CREATE TABLE rides_driver_locations (
  location_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL,
  driver_id     UUID NOT NULL REFERENCES rides_drivers(driver_id) ON DELETE CASCADE,

  location      GEOGRAPHY(POINT) NOT NULL,
  heading       INT,
  speed_kmh     NUMERIC(10,2),

  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rides_driver_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_driver_locations_rls
  ON rides_driver_locations
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- =========================================================
-- DRIVER AVAILABILITY (Online/Offline)
-- =========================================================

CREATE TABLE rides_driver_availability (
  availability_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL,
  driver_id         UUID NOT NULL REFERENCES rides_drivers(driver_id) ON DELETE CASCADE,

  is_online         BOOLEAN NOT NULL DEFAULT FALSE,
  dest_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  dest_lat          NUMERIC,
  dest_lng          NUMERIC,

  updated_at        TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, driver_id)
);

ALTER TABLE rides_driver_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_driver_availability_rls
  ON rides_driver_availability
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- =========================================================
-- DRIVER SESSIONS (controle 12 horas)
-- =========================================================

CREATE TABLE rides_driver_sessions (
  session_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL,
  driver_id         UUID NOT NULL REFERENCES rides_drivers(driver_id) ON DELETE CASCADE,

  started_at        TIMESTAMPTZ NOT NULL,
  ended_at          TIMESTAMPTZ,

  driving_time_minutes  INTEGER DEFAULT 0,
  online_time_minutes   INTEGER DEFAULT 0,

  max_driving_hours     INTEGER DEFAULT 12,
  is_forced_break       BOOLEAN DEFAULT FALSE,
  forced_break_until    TIMESTAMPTZ,
  last_break_at         TIMESTAMPTZ
);

ALTER TABLE rides_driver_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_driver_sessions_rls
  ON rides_driver_sessions
  USING (tenant_id::text = current_setting('app.current_tenant', true));
