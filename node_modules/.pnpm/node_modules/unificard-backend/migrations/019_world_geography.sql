-- ================================================
-- UNIFICARD - MIGRATION 019
-- World Geography: Countries, States, Cities
-- Sistema global de geografia (não multi-tenant)
-- ================================================

-- ===========================
-- COUNTRIES
-- ===========================
CREATE TABLE IF NOT EXISTS countries (
  country_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(2) NOT NULL UNIQUE, -- ISO 3166-1 alpha-2 (ex: "BR", "US")
  name VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_countries_code ON countries (code);
CREATE INDEX IF NOT EXISTS idx_countries_name ON countries (name);

-- ===========================
-- STATES
-- ===========================
CREATE TABLE IF NOT EXISTS states (
  state_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID NOT NULL REFERENCES countries(country_id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL, -- Código do estado (ex: "SP", "RJ", "CA")
  name VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(country_id, code)
);

CREATE INDEX IF NOT EXISTS idx_states_country ON states (country_id);
CREATE INDEX IF NOT EXISTS idx_states_code ON states (code);
CREATE INDEX IF NOT EXISTS idx_states_name ON states (name);

-- ===========================
-- CITIES
-- ===========================
CREATE TABLE IF NOT EXISTS cities (
  city_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id UUID NOT NULL REFERENCES states(state_id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cities_state ON cities (state_id);
CREATE INDEX IF NOT EXISTS idx_cities_name ON cities (name);
CREATE INDEX IF NOT EXISTS idx_cities_name_en ON cities (name_en);
CREATE INDEX IF NOT EXISTS idx_cities_location ON cities (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ===========================
-- COMENTÁRIOS
-- ===========================
COMMENT ON TABLE countries IS 'Países do mundo (dados globais, não multi-tenant)';
COMMENT ON TABLE states IS 'Estados/Províncias dos países';
COMMENT ON TABLE cities IS 'Cidades dos estados';

COMMENT ON COLUMN countries.code IS 'ISO 3166-1 alpha-2 (ex: BR, US, CA)';
COMMENT ON COLUMN states.code IS 'Código do estado dentro do país (ex: SP, RJ, CA)';
COMMENT ON COLUMN cities.latitude IS 'Latitude em graus decimais (WGS84)';
COMMENT ON COLUMN cities.longitude IS 'Longitude em graus decimais (WGS84)';








