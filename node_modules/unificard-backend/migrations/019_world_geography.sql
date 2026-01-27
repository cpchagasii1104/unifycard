/*
Arquivo: 019_world_geography.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Escopo: Geografia global (países, estados, cidades)

Objetivo:
- Catálogo geográfico global, não multi-tenant
- Base para tenants, profissionais, serviços e rides
- Referência única de países, estados e cidades

Observações:
- Não contém regras de negócio
- Não contém dados específicos de domínio
- Deve ser tratado como fonte canônica de geografia
*/

-- =========================================================
-- EXTENSÕES
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- FUNÇÃO PADRÃO updated_at
-- =========================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- COUNTRIES
-- =========================================================

CREATE TABLE IF NOT EXISTS countries (
  country_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(2) NOT NULL, -- ISO 3166-1 alpha-2
  name VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT countries_code_unique UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_countries_code ON countries (code);
CREATE INDEX IF NOT EXISTS idx_countries_name ON countries (name);

DROP TRIGGER IF EXISTS trg_countries_updated_at ON countries;
CREATE TRIGGER trg_countries_updated_at
  BEFORE UPDATE ON countries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- STATES
-- =========================================================

CREATE TABLE IF NOT EXISTS states (
  state_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID NOT NULL REFERENCES countries(country_id) ON DELETE CASCADE,

  code VARCHAR(10) NOT NULL,
  name VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT states_country_code_unique UNIQUE (country_id, code)
);

CREATE INDEX IF NOT EXISTS idx_states_country ON states (country_id);
CREATE INDEX IF NOT EXISTS idx_states_code ON states (code);
CREATE INDEX IF NOT EXISTS idx_states_name ON states (name);

DROP TRIGGER IF EXISTS trg_states_updated_at ON states;
CREATE TRIGGER trg_states_updated_at
  BEFORE UPDATE ON states
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- CITIES
-- =========================================================

CREATE TABLE IF NOT EXISTS cities (
  city_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id UUID NOT NULL REFERENCES states(state_id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),

  latitude NUMERIC(10,8) CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC(11,8) CHECK (longitude BETWEEN -180 AND 180),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT cities_state_name_unique UNIQUE (state_id, name)
);

CREATE INDEX IF NOT EXISTS idx_cities_state ON cities (state_id);
CREATE INDEX IF NOT EXISTS idx_cities_name ON cities (name);
CREATE INDEX IF NOT EXISTS idx_cities_name_en ON cities (name_en);
CREATE INDEX IF NOT EXISTS idx_cities_location
  ON cities (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

DROP TRIGGER IF EXISTS trg_cities_updated_at ON cities;
CREATE TRIGGER trg_cities_updated_at
  BEFORE UPDATE ON cities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- COMENTÁRIOS
-- =========================================================

COMMENT ON TABLE countries IS 'Países do mundo (catálogo global, não multi-tenant)';
COMMENT ON TABLE states IS 'Estados ou províncias vinculados a países';
COMMENT ON TABLE cities IS 'Cidades vinculadas a estados';

COMMENT ON COLUMN countries.code IS 'ISO 3166-1 alpha-2 (ex: BR, US)';
COMMENT ON COLUMN states.code IS 'Código do estado dentro do país (ex: SP, CA)';
COMMENT ON COLUMN cities.latitude IS 'Latitude em graus decimais (WGS84)';
COMMENT ON COLUMN cities.longitude IS 'Longitude em graus decimais (WGS84)';








