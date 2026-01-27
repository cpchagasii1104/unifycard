/*
Arquivo: 015_rides_patch_enhanced.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Escopo: Patch pós-criação do módulo Rides (KPIs, preferências e eventos)

Objetivo:
- Acrescentar métricas e KPIs de motoristas
- Persistir preferências do motorista
- Registrar estatísticas de passageiros
- Capturar eventos de espera e cancelamentos detalhados

Dependências:
- rides_drivers
- rides_rides
- users
- extensões uuid-ossp, pgcrypto
- função update_updated_at_column

Correções:
- min_passenger_rating e rating_avg: NUMERIC(3,2) para suportar 0.00-5.00
*/

-- =========================================================
-- EXTENSÕES
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- FUNÇÃO PADRÃO DE UPDATED_AT
-- =========================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- 1) DRIVERS — MÉTRICAS E KPI
-- =========================================================

ALTER TABLE rides_drivers
  ADD COLUMN IF NOT EXISTS total_trips_completed              INTEGER NOT NULL DEFAULT 0 CHECK (total_trips_completed >= 0),
  ADD COLUMN IF NOT EXISTS total_trips_cancelled_driver       INTEGER NOT NULL DEFAULT 0 CHECK (total_trips_cancelled_driver >= 0),
  ADD COLUMN IF NOT EXISTS total_trips_cancelled_passenger    INTEGER NOT NULL DEFAULT 0 CHECK (total_trips_cancelled_passenger >= 0),
  ADD COLUMN IF NOT EXISTS acceptance_rate                    NUMERIC(5,2) CHECK (acceptance_rate >= 0 AND acceptance_rate <= 100),
  ADD COLUMN IF NOT EXISTS cancellation_rate                  NUMERIC(5,2) CHECK (cancellation_rate >= 0 AND cancellation_rate <= 100),
  ADD COLUMN IF NOT EXISTS last_metrics_calculated_at         TIMESTAMPTZ;

-- =========================================================
-- 2) PREFERÊNCIAS DO MOTORISTA
-- =========================================================

CREATE TABLE IF NOT EXISTS rides_driver_preferences (
  preference_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  driver_id           UUID NOT NULL REFERENCES rides_drivers(driver_id) ON DELETE CASCADE,

  accept_cash                 BOOLEAN NOT NULL DEFAULT FALSE,
  min_passenger_rating        NUMERIC(3,2) CHECK (min_passenger_rating BETWEEN 0 AND 5),
  region_preference_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  preferred_zone_ids          UUID[],
  allow_teen_rides            BOOLEAN NOT NULL DEFAULT FALSE,
  allow_late_night            BOOLEAN NOT NULL DEFAULT TRUE,
  service_type_ids            UUID[],

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, driver_id)
);

ALTER TABLE IF EXISTS rides_driver_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'rides_driver_preferences'
      AND policyname = 'rides_driver_preferences_rls'
  ) THEN
    CREATE POLICY rides_driver_preferences_rls
      ON rides_driver_preferences
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_rides_driver_preferences_updated_at ON rides_driver_preferences;
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
  passenger_user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  total_trips_completed   INTEGER NOT NULL DEFAULT 0 CHECK (total_trips_completed >= 0),
  total_trips_cancelled   INTEGER NOT NULL DEFAULT 0 CHECK (total_trips_cancelled >= 0),
  rating_avg              NUMERIC(3,2) CHECK (rating_avg BETWEEN 0 AND 5),
  rating_count            INTEGER NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
  last_trip_at            TIMESTAMPTZ,
  first_trip_at           TIMESTAMPTZ,

  no_show_count           INTEGER NOT NULL DEFAULT 0 CHECK (no_show_count >= 0),
  late_show_count         INTEGER NOT NULL DEFAULT 0 CHECK (late_show_count >= 0),

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, passenger_user_id)
);

ALTER TABLE IF EXISTS rides_passenger_stats ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'rides_passenger_stats'
      AND policyname = 'rides_passenger_stats_rls'
  ) THEN
    CREATE POLICY rides_passenger_stats_rls
      ON rides_passenger_stats
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_rides_passenger_stats_updated_at ON rides_passenger_stats;
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
  free_wait_seconds      INTEGER CHECK (free_wait_seconds >= 0),
  charged_wait_seconds   INTEGER CHECK (charged_wait_seconds >= 0),
  wait_fee_amount        NUMERIC(10,2) CHECK (wait_fee_amount >= 0),

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS rides_ride_wait_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'rides_ride_wait_events'
      AND policyname = 'rides_ride_wait_events_rls'
  ) THEN
    CREATE POLICY rides_ride_wait_events_rls
      ON rides_ride_wait_events
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- =========================================================
-- 5) CANCELAMENTOS DETALHADOS
-- =========================================================

CREATE TABLE IF NOT EXISTS rides_ride_cancellations (
  cancellation_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                    UUID NOT NULL,
  ride_id                      UUID NOT NULL REFERENCES rides_rides(ride_id) ON DELETE CASCADE,

  cancelled_by                 TEXT NOT NULL
                               CHECK (cancelled_by IN ('driver','passenger','system')),
  reason_code                  TEXT NOT NULL,

  is_penalized_driver          BOOLEAN NOT NULL DEFAULT FALSE,
  is_penalized_passenger       BOOLEAN NOT NULL DEFAULT FALSE,

  distance_driver_travelled_km NUMERIC(10,3) CHECK (distance_driver_travelled_km >= 0),
  time_driver_travelled_sec    INTEGER CHECK (time_driver_travelled_sec >= 0),

  cancellation_fee_passenger   NUMERIC(10,2) CHECK (cancellation_fee_passenger >= 0),
  amount_paid_to_driver        NUMERIC(10,2) CHECK (amount_paid_to_driver >= 0),

  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS rides_ride_cancellations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'rides_ride_cancellations'
      AND policyname = 'rides_ride_cancellations_rls'
  ) THEN
    CREATE POLICY rides_ride_cancellations_rls
      ON rides_ride_cancellations
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- =========================================================
-- FIM DO PATCH 015
-- =========================================================