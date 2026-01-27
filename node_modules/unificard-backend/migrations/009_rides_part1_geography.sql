/*
Arquivo: 009_rides_part1_geography.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Escopo: Geografia do módulo Rides

Objetivo:
- Definir regiões, cidades e zonas operacionais
- Suporte a cálculos espaciais

Dependências:
- PostGIS
Observações:
- Base geográfica para todo o módulo de rides
*/


CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS rides_regions (
  region_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL,
  name        VARCHAR(150) NOT NULL,
  code        VARCHAR(50),
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, name)
);

ALTER TABLE IF EXISTS rides_regions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname=current_schema() AND tablename='rides_regions' AND policyname='rides_regions_rls'
  ) THEN
    CREATE POLICY rides_regions_rls ON rides_regions
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_rides_regions_updated_at ON rides_regions;
CREATE TRIGGER trg_rides_regions_updated_at
  BEFORE UPDATE ON rides_regions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS rides_cities (
  city_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL,
  region_id   UUID REFERENCES rides_regions(region_id) ON DELETE SET NULL,
  name        VARCHAR(150) NOT NULL,
  code        VARCHAR(50),
  center      GEOGRAPHY(POINT),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, name)
);

ALTER TABLE IF EXISTS rides_cities ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname=current_schema() AND tablename='rides_cities' AND policyname='rides_cities_rls'
  ) THEN
    CREATE POLICY rides_cities_rls ON rides_cities
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_rides_cities_updated_at ON rides_cities;
CREATE TRIGGER trg_rides_cities_updated_at
  BEFORE UPDATE ON rides_cities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS rides_zones (
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

ALTER TABLE IF EXISTS rides_zones ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname=current_schema() AND tablename='rides_zones' AND policyname='rides_zones_rls'
  ) THEN
    CREATE POLICY rides_zones_rls ON rides_zones
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rides_zones_polygon
  ON rides_zones USING GIST(polygon);

DROP TRIGGER IF EXISTS trg_rides_zones_updated_at ON rides_zones;
CREATE TRIGGER trg_rides_zones_updated_at
  BEFORE UPDATE ON rides_zones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS rides_city_service_types (
  city_service_type_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID NOT NULL,
  city_id              UUID NOT NULL REFERENCES rides_cities(city_id) ON DELETE CASCADE,
  service_type_id      UUID NOT NULL,
  is_enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  metadata             JSONB DEFAULT '{}',
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, city_id, service_type_id)
);

ALTER TABLE IF EXISTS rides_city_service_types ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname=current_schema() AND tablename='rides_city_service_types' AND policyname='rides_city_service_types_rls'
  ) THEN
    CREATE POLICY rides_city_service_types_rls ON rides_city_service_types
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_rides_city_service_types_updated_at ON rides_city_service_types;
CREATE TRIGGER trg_rides_city_service_types_updated_at
  BEFORE UPDATE ON rides_city_service_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();