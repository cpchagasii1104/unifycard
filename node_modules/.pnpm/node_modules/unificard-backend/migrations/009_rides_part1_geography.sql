-- =========================================================
-- 009_rides_part1_geography.sql
-- Estruturas: regions, cities, zones, city_service_types
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Helper de updated_at (já existe no core; garantimos)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- 1) REGIONS (Estados / Áreas maiores)
-- =========================================================

CREATE TABLE rides_regions (
  region_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL,
  name        VARCHAR(150) NOT NULL,
  code        VARCHAR(50),
  metadata    JSONB DEFAULT '{}',

  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, name)
);

ALTER TABLE rides_regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_regions_rls
  ON rides_regions
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE TRIGGER trg_rides_regions_updated_at
  BEFORE UPDATE ON rides_regions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- 2) CITIES
-- =========================================================

CREATE TABLE rides_cities (
  city_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL,

  region_id   UUID REFERENCES rides_regions(region_id) ON DELETE SET NULL,
  name        VARCHAR(150) NOT NULL,
  code        VARCHAR(50),

  -- Centro da cidade
  center      GEOGRAPHY(POINT),

  -- Configurações
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  metadata    JSONB DEFAULT '{}',

  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, name)
);

ALTER TABLE rides_cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_cities_rls
  ON rides_cities
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE TRIGGER trg_rides_cities_updated_at
  BEFORE UPDATE ON rides_cities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- 3) ZONES (Polígonos / Bairros)
-- =========================================================

CREATE TABLE rides_zones (
  zone_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL,
  city_id     UUID NOT NULL REFERENCES rides_cities(city_id) ON DELETE CASCADE,

  name        VARCHAR(150) NOT NULL,

  polygon     GEOGRAPHY(POLYGON) NOT NULL,
  centroid    GEOGRAPHY(POINT),

  is_active   BOOLEAN DEFAULT TRUE,
  metadata    JSONB DEFAULT '{}',

  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, city_id, name)
);

ALTER TABLE rides_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_zones_rls
  ON rides_zones
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE INDEX idx_rides_zones_polygon ON rides_zones USING GIST(polygon);

CREATE TRIGGER trg_rides_zones_updated_at
  BEFORE UPDATE ON rides_zones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- 4) SERVICE TYPES por CIDADE (ativação)
-- =========================================================

CREATE TABLE rides_city_service_types (
  city_service_type_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID NOT NULL,
  city_id              UUID NOT NULL REFERENCES rides_cities(city_id) ON DELETE CASCADE,
  service_type_id      UUID NOT NULL,  -- referência futura a rides_service_types

  is_enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  metadata             JSONB DEFAULT '{}',

  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, city_id, service_type_id)
);

ALTER TABLE rides_city_service_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY rides_city_service_types_rls
  ON rides_city_service_types
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE TRIGGER trg_rides_city_service_types_updated_at
  BEFORE UPDATE ON rides_city_service_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
