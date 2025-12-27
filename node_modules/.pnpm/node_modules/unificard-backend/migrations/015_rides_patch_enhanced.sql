-- =========================================================
-- 015_rides_patch_enhanced.sql
-- Patch final pós-criação das tabelas base do módulo Rides
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper padrão Unificard
-- (deve existir desde migrations anteriores – aqui só garantimos)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- 1) DRIVERS – MÉTRICAS E KPI
-- =========================================================

ALTER TABLE rides_drivers
  ADD COLUMN IF NOT EXISTS total_trips_completed              INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_trips_cancelled_driver       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_trips_cancelled_passenger    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acceptance_rate                    NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS cancellation_rate                  NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS last_metrics_calculated_at         TIMESTAMPTZ;

-- =========================================================
-- 2) PREFERÊNCIAS DO MOTORISTA
-- =========================================================

CREATE TABLE IF NOT EXISTS rides_driver_preferences (
  preference_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  driver_id           UUID NOT NULL REFERENCES rides_drivers(driver_id) ON DELETE CASCADE,

  accept_cash                 BOOLEAN NOT NULL DEFAULT FALSE,
  min_passenger_rating        NUMERIC(2,2),
  region_preference_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  preferred_zone_ids          UUID[],
  allow_teen_rides            BOOLEAN NOT NULL DEFAULT FALSE,
  allow_late_night            BOOLEAN NOT NULL DEFAULT TRUE,
  service_type_ids            UUID[],

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, driver_id)
);

ALTER TABLE rides_driver_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_driver_preferences_rls
  ON rides_driver_preferences
  USING (tenant_id::text = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));

CREATE TRIGGER trg_rides_driver_preferences_updated_at
  BEFORE UPDATE ON rides_driver_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- 3) ESTATÍSTICAS DO PASSAGEIRO
-- =========================================================

CREATE TABLE IF NOT EXISTS rides_passenger_stats (
  passenger_stats_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL,
  passenger_user_id       UUID NOT NULL,

  total_trips_completed   INTEGER NOT NULL DEFAULT 0,
  total_trips_cancelled   INTEGER NOT NULL DEFAULT 0,
  rating_avg              NUMERIC(2,2),
  rating_count            INTEGER NOT NULL DEFAULT 0,
  last_trip_at            TIMESTAMPTZ,
  first_trip_at           TIMESTAMPTZ,

  no_show_count           INTEGER NOT NULL DEFAULT 0,
  late_show_count         INTEGER NOT NULL DEFAULT 0,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, passenger_user_id)
);

ALTER TABLE rides_passenger_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_passenger_stats_rls
  ON rides_passenger_stats
  USING (tenant_id::text = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));

CREATE TRIGGER trg_rides_passenger_stats_updated_at
  BEFORE UPDATE ON rides_passenger_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- 4) EVENTOS DE ESPERA NO EMBARQUE
-- =========================================================

CREATE TABLE IF NOT EXISTS rides_ride_wait_events (
  wait_event_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL,
  ride_id                UUID NOT NULL REFERENCES rides_rides(ride_id) ON DELETE CASCADE,

  driver_arrived_at      TIMESTAMPTZ,
  passenger_notified_at  TIMESTAMPTZ,
  free_wait_seconds      INTEGER,
  charged_wait_seconds   INTEGER,
  wait_fee_amount        NUMERIC(10,2),

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE rides_ride_wait_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_ride_wait_events_rls
  ON rides_ride_wait_events
  USING (tenant_id::text = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));

-- =========================================================
-- 5) CANCELAMENTOS DETALHADOS
-- =========================================================

CREATE TABLE IF NOT EXISTS rides_ride_cancellations (
  cancellation_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL,
  ride_id                  UUID NOT NULL REFERENCES rides_rides(ride_id) ON DELETE CASCADE,

  cancelled_by             TEXT NOT NULL CHECK (cancelled_by IN ('driver','passenger','system')),
  reason_code              TEXT NOT NULL,

  is_penalized_driver      BOOLEAN NOT NULL DEFAULT FALSE,
  is_penalized_passenger   BOOLEAN NOT NULL DEFAULT FALSE,

  distance_driver_travelled_km NUMERIC(10,3),
  time_driver_travelled_sec    INTEGER,

  cancellation_fee_passenger   NUMERIC(10,2),
  amount_paid_to_driver        NUMERIC(10,2),

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE rides_ride_cancellations ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_ride_cancellations_rls
  ON rides_ride_cancellations
  USING (tenant_id::text = current_setting('app.current_tenant', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));

-- =========================================================
-- FIM DO PATCH 015
-- =========================================================
