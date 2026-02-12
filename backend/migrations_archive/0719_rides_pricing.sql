/*
Arquivo: 012_rides_part4_pricing.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Escopo: Tipos de serviço, pricing base, pressão de demanda e incentivos

Objetivo:
- Definir tipos de serviço por tenant
- Configurar precificação base por cidade
- Registrar pressão de demanda por zona
- Gerenciar incentivos dinâmicos por zona

Dependências:
- rides_cities
- rides_zones
- função update_updated_at_column()
*/

-- =========================================================
-- SERVICE TYPES
-- =========================================================

CREATE TABLE IF NOT EXISTS rides_service_types (
  service_type_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL,

  name            VARCHAR(80) NOT NULL,
  description     TEXT,
  icon            TEXT,
  capacity        INTEGER DEFAULT 4 CHECK (capacity > 0),

  base_price      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (base_price >= 0),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, name)
);

ALTER TABLE rides_service_types ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'rides_service_types'
      AND policyname = 'rides_service_types_rls'
  ) THEN
    CREATE POLICY rides_service_types_rls
      ON rides_service_types
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- Trigger updated_at (correção de consistência)
DROP TRIGGER IF EXISTS trg_rides_service_types_updated_at ON rides_service_types;
CREATE TRIGGER trg_rides_service_types_updated_at
  BEFORE UPDATE ON rides_service_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- PRICING BASE
-- =========================================================

CREATE TABLE IF NOT EXISTS rides_pricing_config (
  pricing_config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL,
  city_id           UUID NOT NULL REFERENCES rides_cities(city_id),

  base_fare         NUMERIC(10,2) NOT NULL CHECK (base_fare >= 0),
  per_km            NUMERIC(10,2) NOT NULL CHECK (per_km >= 0),
  per_minute        NUMERIC(10,2) NOT NULL CHECK (per_minute >= 0),

  night_multiplier  NUMERIC(5,2) CHECK (night_multiplier >= 0),
  rain_multiplier   NUMERIC(5,2) CHECK (rain_multiplier >= 0),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, city_id)
);

ALTER TABLE rides_pricing_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'rides_pricing_config'
      AND policyname = 'rides_pricing_config_rls'
  ) THEN
    CREATE POLICY rides_pricing_config_rls
      ON rides_pricing_config
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_rides_pricing_config_updated_at ON rides_pricing_config;
CREATE TRIGGER trg_rides_pricing_config_updated_at
  BEFORE UPDATE ON rides_pricing_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- DEMAND PRESSURE
-- =========================================================

CREATE TABLE IF NOT EXISTS rides_zone_demand_pressure (
  pressure_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id          UUID NOT NULL,
  zone_id            UUID NOT NULL REFERENCES rides_zones(zone_id),

  active_requests    INTEGER NOT NULL DEFAULT 0 CHECK (active_requests >= 0),
  available_drivers  INTEGER NOT NULL DEFAULT 0 CHECK (available_drivers >= 0),

  pressure           NUMERIC(10,2) CHECK (pressure >= 0),

  calculated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE rides_zone_demand_pressure ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'rides_zone_demand_pressure'
      AND policyname = 'rides_zone_demand_pressure_rls'
  ) THEN
    CREATE POLICY rides_zone_demand_pressure_rls
      ON rides_zone_demand_pressure
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- =========================================================
-- ZONE INCENTIVES
-- =========================================================

CREATE TABLE IF NOT EXISTS rides_zone_incentives (
  incentive_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL,
  zone_id         UUID NOT NULL REFERENCES rides_zones(zone_id),

  incentive_type  VARCHAR(30) NOT NULL, -- per_km | per_ride | bonus
  incentive_value NUMERIC(10,2) NOT NULL CHECK (incentive_value >= 0),

  reason          VARCHAR(50),

  starts_at       TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE rides_zone_incentives ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'rides_zone_incentives'
      AND policyname = 'rides_zone_incentives_rls'
  ) THEN
    CREATE POLICY rides_zone_incentives_rls
      ON rides_zone_incentives
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;
