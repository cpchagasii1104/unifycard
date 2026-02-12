-- 🔴 LEGADO — Estrutura temporal paralela (rides_driver_availability).
-- 🔴 PROIBIDO USO EM NOVO CÓDIGO.
-- 🔴 Migrar para Unified Availability (migration 144).

/*
Arquivo: 010_rides_part2_drivers_vehicles.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Escopo: Motoristas e veículos
*/

-- =========================================================
-- EXTENSÕES
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- =========================================================
-- FUNÇÃO PADRÃO updated_at (defensivo)
-- =========================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- DRIVERS
-- =========================================================

CREATE TABLE IF NOT EXISTS rides_drivers (
  driver_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified   BOOLEAN NOT NULL DEFAULT FALSE,

  rating_avg    NUMERIC(3,2) CHECK (rating_avg BETWEEN 0 AND 5),
  rating_count  INTEGER NOT NULL DEFAULT 0 CHECK (rating_count >= 0),

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, user_id)
);

ALTER TABLE rides_drivers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'rides_drivers'
      AND policyname = 'rides_drivers_rls'
  ) THEN
    CREATE POLICY rides_drivers_rls
      ON rides_drivers
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_rides_drivers_updated_at ON rides_drivers;
CREATE TRIGGER trg_rides_drivers_updated_at
  BEFORE UPDATE ON rides_drivers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- VEHICLES
-- =========================================================

CREATE TABLE IF NOT EXISTS rides_vehicles (
  vehicle_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  driver_id     UUID NOT NULL REFERENCES rides_drivers(driver_id) ON DELETE CASCADE,

  brand         VARCHAR(100),
  model         VARCHAR(100),
  year          INTEGER CHECK (year >= 1980),
  plate         VARCHAR(20) NOT NULL,
  color         VARCHAR(50),
  type          VARCHAR(50),

  capacity      INTEGER NOT NULL DEFAULT 4 CHECK (capacity > 0),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, plate)
);

ALTER TABLE rides_vehicles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'rides_vehicles'
      AND policyname = 'rides_vehicles_rls'
  ) THEN
    CREATE POLICY rides_vehicles_rls
      ON rides_vehicles
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_rides_vehicles_updated_at ON rides_vehicles;
CREATE TRIGGER trg_rides_vehicles_updated_at
  BEFORE UPDATE ON rides_vehicles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- DRIVER SERVICES
-- =========================================================

CREATE TABLE IF NOT EXISTS rides_driver_services (
  driver_service_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  driver_id         UUID NOT NULL REFERENCES rides_drivers(driver_id) ON DELETE CASCADE,
  service_type_id   UUID NOT NULL,

  is_enabled        BOOLEAN NOT NULL DEFAULT TRUE,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, driver_id, service_type_id)
);

ALTER TABLE rides_driver_services ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'rides_driver_services'
      AND policyname = 'rides_driver_services_rls'
  ) THEN
    CREATE POLICY rides_driver_services_rls
      ON rides_driver_services
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_rides_driver_services_updated_at ON rides_driver_services;
CREATE TRIGGER trg_rides_driver_services_updated_at
  BEFORE UPDATE ON rides_driver_services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- DRIVER LOCATIONS (HOT PATH)
-- =========================================================

CREATE TABLE IF NOT EXISTS rides_driver_locations (
  location_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  driver_id     UUID NOT NULL REFERENCES rides_drivers(driver_id) ON DELETE CASCADE,

  location      GEOGRAPHY(POINT) NOT NULL,
  heading       INTEGER,
  speed_kmh     NUMERIC(10,2) CHECK (speed_kmh >= 0),

  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE rides_driver_locations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'rides_driver_locations'
      AND policyname = 'rides_driver_locations_rls'
  ) THEN
    CREATE POLICY rides_driver_locations_rls
      ON rides_driver_locations
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rides_driver_locations_driver
  ON rides_driver_locations (driver_id);

-- =========================================================
-- DRIVER AVAILABILITY (LEGADO)
-- =========================================================

CREATE TABLE IF NOT EXISTS rides_driver_availability (
  availability_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  driver_id         UUID NOT NULL REFERENCES rides_drivers(driver_id) ON DELETE CASCADE,

  is_online         BOOLEAN NOT NULL DEFAULT FALSE,
  dest_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  dest_lat          NUMERIC,
  dest_lng          NUMERIC,

  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, driver_id)
);

ALTER TABLE rides_driver_availability ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'rides_driver_availability'
      AND policyname = 'rides_driver_availability_rls'
  ) THEN
    CREATE POLICY rides_driver_availability_rls
      ON rides_driver_availability
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rides_driver_availability_online
  ON rides_driver_availability (tenant_id, is_online);

-- =========================================================
-- DRIVER SESSIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS rides_driver_sessions (
  session_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  driver_id             UUID NOT NULL REFERENCES rides_drivers(driver_id) ON DELETE CASCADE,

  started_at            TIMESTAMPTZ NOT NULL,
  ended_at              TIMESTAMPTZ,

  driving_time_minutes  INTEGER NOT NULL DEFAULT 0 CHECK (driving_time_minutes >= 0),
  online_time_minutes   INTEGER NOT NULL DEFAULT 0 CHECK (online_time_minutes >= 0),

  max_driving_hours     INTEGER NOT NULL DEFAULT 12 CHECK (max_driving_hours > 0),
  is_forced_break       BOOLEAN NOT NULL DEFAULT FALSE,
  forced_break_until    TIMESTAMPTZ,
  last_break_at         TIMESTAMPTZ
);

ALTER TABLE rides_driver_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'rides_driver_sessions'
      AND policyname = 'rides_driver_sessions_rls'
  ) THEN
    CREATE POLICY rides_driver_sessions_rls
      ON rides_driver_sessions
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rides_driver_sessions_active
  ON rides_driver_sessions (driver_id)
  WHERE ended_at IS NULL;
