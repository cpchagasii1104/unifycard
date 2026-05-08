-- ============================================================
-- F3-S4 — Location Core base (countries, states, cities, neighborhoods)
-- ============================================================
-- Remete a: DECISION-0020 (REMEDIATION_DECISIONS_LOG.md)
-- Frente: F3 — Domain Foundations: Location Core Materialization
-- Resgate de plano arquivado em migrations_archive/0360-0361
-- com schema atualizado para escala planetaria incremental (Brasil-first).
--
-- Escopo desta migration:
--   1. Helpers institucionais (update_updated_at_column, normalize_name)
--   2. Catalogo administrativo: countries, states, cities, neighborhoods
--   3. Triggers de updated_at automatico
--   4. GENERATED COLUMN name_normalized (defesa contra duplicatas)
--
-- Fora de escopo (sessoes seguintes):
--   F3-S5: seed Brasil (27 estados + capitais + IBGE codes)
--   F3-S6: addresses + address_assignments
--   F3-S7: economic_regions + economic_region_members
--   F3-S8: integracao companies (resolve A5 do log de runtime)
--
-- Principios de design fixos (DECISION-0020):
--   1. CEP e UX, nao fonte de verdade
--   2. Territorio por IDs, nao strings livres
--   3. external_code (nao ibge_code) - nao congelar BR
--   4. name_normalized = lower(unaccent(name)) helper unico
--   5. Defesa estrutural via CHECK e GENERATED COLUMNS
--
-- RLS: NAO se aplica (catalogo global, nao multi-tenant).
-- Forward-only. Idempotente via IF NOT EXISTS / CREATE OR REPLACE.
-- ============================================================

BEGIN;

-- ============================================================
-- EXTENSOES
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "unaccent";  -- helper de normalizacao

-- ============================================================
-- HELPER: update_updated_at_column
-- ============================================================
-- Trigger function canonica para auto-update de updated_at.
-- Reaproveita nome do plano original (migrations_archive/0360).
-- Padrao institucional: aplicar em todas as tabelas com updated_at.
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- HELPER: normalize_name (DECISION-0020 principio #4)
-- ============================================================
-- "Sao Paulo", "São Paulo", "são paulo" devem virar a mesma chave.
-- IMMUTABLE permite uso em GENERATED COLUMN e indices funcionais.
-- Chamado por geographic tables; codigo backend deve usar mesma funcao
-- via query SQL para garantir consistencia (decisao diferida #6 resolvida).
-- ============================================================

CREATE OR REPLACE FUNCTION normalize_name(input_name TEXT)
RETURNS TEXT AS $$
  SELECT LOWER(unaccent(COALESCE(input_name, '')));
$$ LANGUAGE SQL IMMUTABLE;

-- ============================================================
-- COUNTRIES (camada administrativa nivel 0)
-- ============================================================
-- Catalogo de paises. Brasil-first incremental: seed inicial popula
-- apenas BR, mas schema suporta qualquer pais sem alteracao.
--
-- iso_alpha2: chave externa estavel (ISO 3166-1 alpha-2). UNIQUE.
-- name_localized: traducoes por idioma ({"en":"Brazil","es":"Brasil"}).
-- timezone_default: timezone padrao do pais (pode ter regioes diferentes).
-- ============================================================

CREATE TABLE IF NOT EXISTS countries (
  country_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iso_alpha2        TEXT NOT NULL UNIQUE,
  iso_alpha3        TEXT,
  name              TEXT NOT NULL,
  name_localized    JSONB NOT NULL DEFAULT '{}'::jsonb,
  phone_code        TEXT,
  currency_code     TEXT,
  timezone_default  TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT countries_iso_alpha2_format
    CHECK (iso_alpha2 ~ '^[A-Z]{2}$'),
  CONSTRAINT countries_iso_alpha3_format
    CHECK (iso_alpha3 IS NULL OR iso_alpha3 ~ '^[A-Z]{3}$')
);

CREATE INDEX IF NOT EXISTS idx_countries_iso_alpha2
  ON countries(iso_alpha2);
CREATE INDEX IF NOT EXISTS idx_countries_is_active
  ON countries(is_active) WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS trg_countries_updated_at ON countries;
CREATE TRIGGER trg_countries_updated_at
  BEFORE UPDATE ON countries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE countries IS
  'Catalogo de paises. SSOT geografico nivel 0.
   iso_alpha2 e chave externa estavel (BR, US, AR, ...).
   name_localized JSONB suporta traducoes futuras sem migration.';

-- ============================================================
-- STATES (camada administrativa nivel 1)
-- ============================================================
-- Subdivisoes nacionais (estados/provincias/regioes/lander).
-- "state" e nome generico - nomenclatura local fica em name_localized.
--
-- iso_3166_2: codigo ISO subnacional ("BR-PR", "US-CA"). Opcional.
-- external_code: codigo externo livre (IBGE numerico no caso BR,
--   FIPS no caso US, NUTS no caso UE). NAO chamar de "ibge_code"
--   para nao congelar BR na ontologia (DECISION-0020 principio #3).
-- abbreviation: sigla local ("PR", "CA", "BY"). Opcional.
-- name_normalized: GENERATED COLUMN automatica. Defesa estrutural
--   contra duplicatas case/accent.
-- UNIQUE(country_id, name_normalized): impede dois "Sao Paulo" no BR.
-- ============================================================

CREATE TABLE IF NOT EXISTS states (
  state_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id        UUID NOT NULL REFERENCES countries(country_id) ON DELETE RESTRICT,
  iso_3166_2        TEXT,
  external_code     TEXT,
  name              TEXT NOT NULL,
  name_normalized   TEXT GENERATED ALWAYS AS (normalize_name(name)) STORED,
  abbreviation      TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT states_country_name_unique
    UNIQUE (country_id, name_normalized)
);

CREATE INDEX IF NOT EXISTS idx_states_country
  ON states(country_id);
CREATE INDEX IF NOT EXISTS idx_states_iso_3166_2
  ON states(iso_3166_2) WHERE iso_3166_2 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_states_external_code
  ON states(external_code) WHERE external_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_states_is_active
  ON states(is_active) WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS trg_states_updated_at ON states;
CREATE TRIGGER trg_states_updated_at
  BEFORE UPDATE ON states
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE states IS
  'Subdivisoes nacionais nivel 1 (estados, provincias, regioes).
   external_code permite IBGE/FIPS/NUTS sem congelar BR na ontologia.
   name_normalized e GENERATED COLUMN: defesa estrutural anti-duplicata.';

-- ============================================================
-- CITIES (camada administrativa nivel 2)
-- ============================================================
-- Municipios/cidades. Nivel onde a maioria das operacoes territoriais
-- opera (delivery, rides, fundo regional via economic_region_members).
--
-- external_code: codigo externo (IBGE 7 digitos para BR).
-- lat/lng: centroide aproximado da cidade (NUMERIC(10,7) ~1cm precisao).
--   Opcional - cidade pode existir sem geocoding (cidade rural recente,
--   por exemplo). Quando ausente, queries de proximidade pulam ou
--   usam state como fallback.
-- ============================================================

CREATE TABLE IF NOT EXISTS cities (
  city_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id          UUID NOT NULL REFERENCES states(state_id) ON DELETE RESTRICT,
  external_code     TEXT,
  name              TEXT NOT NULL,
  name_normalized   TEXT GENERATED ALWAYS AS (normalize_name(name)) STORED,
  lat               NUMERIC(10,7),
  lng               NUMERIC(10,7),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT cities_state_name_unique
    UNIQUE (state_id, name_normalized),
  CONSTRAINT cities_lat_range
    CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),
  CONSTRAINT cities_lng_range
    CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180)),
  CONSTRAINT cities_latlng_paired
    CHECK ((lat IS NULL AND lng IS NULL) OR (lat IS NOT NULL AND lng IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_cities_state
  ON cities(state_id);
CREATE INDEX IF NOT EXISTS idx_cities_external_code
  ON cities(external_code) WHERE external_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cities_name_normalized
  ON cities(name_normalized);
CREATE INDEX IF NOT EXISTS idx_cities_is_active
  ON cities(is_active) WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS trg_cities_updated_at ON cities;
CREATE TRIGGER trg_cities_updated_at
  BEFORE UPDATE ON cities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE cities IS
  'Cidades/municipios nivel 2. lat/lng opcional (centroide aproximado).
   CHECK garante par lat-lng coerente: ambos NULL ou ambos preenchidos.
   external_code: IBGE 7 digitos para BR; FIPS/equivalente para outros.';

-- ============================================================
-- NEIGHBORHOODS (camada administrativa nivel 3)
-- ============================================================
-- Bairros/distritos dentro de uma cidade. Granularidade fina,
-- usada principalmente para enderecos urbanos (CEP -> bairro).
--
-- Sem lat/lng inicialmente: bairro tem polígono, nao centroide util.
-- (Decisao diferida #2 da DECISION-0020: poligonos ficam para futuro.)
-- ============================================================

CREATE TABLE IF NOT EXISTS neighborhoods (
  neighborhood_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id           UUID NOT NULL REFERENCES cities(city_id) ON DELETE RESTRICT,
  name              TEXT NOT NULL,
  name_normalized   TEXT GENERATED ALWAYS AS (normalize_name(name)) STORED,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT neighborhoods_city_name_unique
    UNIQUE (city_id, name_normalized)
);

CREATE INDEX IF NOT EXISTS idx_neighborhoods_city
  ON neighborhoods(city_id);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_is_active
  ON neighborhoods(is_active) WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS trg_neighborhoods_updated_at ON neighborhoods;
CREATE TRIGGER trg_neighborhoods_updated_at
  BEFORE UPDATE ON neighborhoods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE neighborhoods IS
  'Bairros/distritos nivel 3. Granularidade fina para enderecos.
   Sem lat/lng: poligono e mais util que centroide para bairro
   (decisao diferida #2 da DECISION-0020).';

-- ============================================================
-- COMMIT
-- ============================================================

COMMIT;

-- ============================================================
-- VALIDACAO POS-APLICACAO (rodar manualmente apos COMMIT)
-- ============================================================
-- Esperado:
--   \d countries        -> 11 colunas, 2 indices, 1 trigger
--   \d states           -> 10 colunas (incluindo name_normalized
--                          GENERATED), FK para countries, UNIQUE
--   \d cities           -> 11 colunas (incluindo lat/lng), FK para
--                          states, 4 CHECK constraints
--   \d neighborhoods    -> 7 colunas, FK para cities
--
--   SELECT proname FROM pg_proc WHERE proname IN
--     ('update_updated_at_column', 'normalize_name');
--   -> 2 linhas
--
--   SELECT normalize_name('São Paulo'),
--          normalize_name('SAO PAULO'),
--          normalize_name('sao paulo');
--   -> todas devem retornar 'sao paulo'
-- ============================================================
