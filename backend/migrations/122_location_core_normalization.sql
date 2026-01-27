-- ============================================================
-- UNIFICARD — MIGRATION 116
-- Arquivo: 116_location_core_normalization.sql
-- Location Core: Normalização e enriquecimento
-- Banco alvo: PostgreSQL 14+
--
-- OBJETIVO
-- Adicionar campos name_display e name_normalized para:
-- - Garantir unicidade por versão normalizada
-- - Permitir busca case-insensitive e sem acento
-- - Exibir nomes formatados na UI
--
-- ESCOPO
-- ✔ Adicionar campos name_display e name_normalized
-- ✔ Criar função de normalização
-- ✔ Criar triggers para normalização automática
-- ✔ Atualizar constraints de unicidade
-- ✔ Não quebra dados existentes
--
-- ============================================================

BEGIN;

-- ============================================================
-- FUNÇÃO DE NORMALIZAÇÃO
-- ============================================================

CREATE OR REPLACE FUNCTION normalize_location_name(name_text TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Remove acentos, converte para lowercase, remove espaços extras
  RETURN LOWER(
    TRANSLATE(
      TRIM(name_text),
      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaeeeeiiiioooouuuucnAAAAAEEEEIIIIOOOOUUUUCN'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- ATUALIZAR COUNTRIES
-- ============================================================

-- Adicionar campos se não existirem
ALTER TABLE countries
  ADD COLUMN IF NOT EXISTS name_display VARCHAR(255),
  ADD COLUMN IF NOT EXISTS name_normalized VARCHAR(255);

-- Preencher campos existentes
UPDATE countries
SET 
  name_display = COALESCE(name_display, name),
  name_normalized = COALESCE(name_normalized, normalize_location_name(name))
WHERE name_display IS NULL OR name_normalized IS NULL;

-- Tornar campos obrigatórios
ALTER TABLE countries
  ALTER COLUMN name_display SET NOT NULL,
  ALTER COLUMN name_normalized SET NOT NULL;

-- Atualizar constraint de unicidade para usar name_normalized
ALTER TABLE countries DROP CONSTRAINT IF EXISTS countries_code_unique;
ALTER TABLE countries ADD CONSTRAINT countries_code_unique UNIQUE (code);

-- Criar índice para busca normalizada
CREATE INDEX IF NOT EXISTS idx_countries_name_normalized ON countries (name_normalized);

-- Trigger para normalização automática
CREATE OR REPLACE FUNCTION trg_countries_normalize()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS NOT NULL THEN
    NEW.name_display := NEW.name;
    NEW.name_normalized := normalize_location_name(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_countries_normalize_trigger ON countries;
CREATE TRIGGER trg_countries_normalize_trigger
  BEFORE INSERT OR UPDATE OF name ON countries
  FOR EACH ROW
  EXECUTE FUNCTION trg_countries_normalize();

-- ============================================================
-- ATUALIZAR STATES
-- ============================================================

ALTER TABLE states
  ADD COLUMN IF NOT EXISTS name_display VARCHAR(255),
  ADD COLUMN IF NOT EXISTS name_normalized VARCHAR(255);

UPDATE states
SET 
  name_display = COALESCE(name_display, name),
  name_normalized = COALESCE(name_normalized, normalize_location_name(name))
WHERE name_display IS NULL OR name_normalized IS NULL;

ALTER TABLE states
  ALTER COLUMN name_display SET NOT NULL,
  ALTER COLUMN name_normalized SET NOT NULL;

-- Atualizar constraint de unicidade
ALTER TABLE states DROP CONSTRAINT IF EXISTS states_country_code_unique;
ALTER TABLE states ADD CONSTRAINT states_country_code_unique UNIQUE (country_id, code);

-- Adicionar constraint de unicidade por name_normalized
ALTER TABLE states DROP CONSTRAINT IF EXISTS states_country_name_normalized_unique;
ALTER TABLE states ADD CONSTRAINT states_country_name_normalized_unique UNIQUE (country_id, name_normalized);

CREATE INDEX IF NOT EXISTS idx_states_name_normalized ON states (country_id, name_normalized);

CREATE OR REPLACE FUNCTION trg_states_normalize()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS NOT NULL THEN
    NEW.name_display := NEW.name;
    NEW.name_normalized := normalize_location_name(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_states_normalize_trigger ON states;
CREATE TRIGGER trg_states_normalize_trigger
  BEFORE INSERT OR UPDATE OF name ON states
  FOR EACH ROW
  EXECUTE FUNCTION trg_states_normalize();

-- ============================================================
-- ATUALIZAR CITIES
-- ============================================================

ALTER TABLE cities
  ADD COLUMN IF NOT EXISTS name_display VARCHAR(255),
  ADD COLUMN IF NOT EXISTS name_normalized VARCHAR(255);

UPDATE cities
SET 
  name_display = COALESCE(name_display, name),
  name_normalized = COALESCE(name_normalized, normalize_location_name(name))
WHERE name_display IS NULL OR name_normalized IS NULL;

ALTER TABLE cities
  ALTER COLUMN name_display SET NOT NULL,
  ALTER COLUMN name_normalized SET NOT NULL;

-- Atualizar constraint de unicidade
ALTER TABLE cities DROP CONSTRAINT IF EXISTS cities_state_name_unique;
ALTER TABLE cities ADD CONSTRAINT cities_state_name_normalized_unique UNIQUE (state_id, name_normalized);

CREATE INDEX IF NOT EXISTS idx_cities_name_normalized ON cities (state_id, name_normalized);

CREATE OR REPLACE FUNCTION trg_cities_normalize()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS NOT NULL THEN
    NEW.name_display := NEW.name;
    NEW.name_normalized := normalize_location_name(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cities_normalize_trigger ON cities;
CREATE TRIGGER trg_cities_normalize_trigger
  BEFORE INSERT OR UPDATE OF name ON cities
  FOR EACH ROW
  EXECUTE FUNCTION trg_cities_normalize();

-- ============================================================
-- ATUALIZAR NEIGHBORHOODS
-- ============================================================

ALTER TABLE neighborhoods
  ADD COLUMN IF NOT EXISTS name_display VARCHAR(255),
  ADD COLUMN IF NOT EXISTS name_normalized VARCHAR(255);

UPDATE neighborhoods
SET 
  name_display = COALESCE(name_display, name),
  name_normalized = COALESCE(name_normalized, normalize_location_name(name))
WHERE name_display IS NULL OR name_normalized IS NULL;

ALTER TABLE neighborhoods
  ALTER COLUMN name_display SET NOT NULL,
  ALTER COLUMN name_normalized SET NOT NULL;

-- Atualizar constraint de unicidade
ALTER TABLE neighborhoods DROP CONSTRAINT IF EXISTS neighborhoods_city_name_unique;
ALTER TABLE neighborhoods ADD CONSTRAINT neighborhoods_city_name_normalized_unique UNIQUE (city_id, name_normalized);

CREATE INDEX IF NOT EXISTS idx_neighborhoods_name_normalized ON neighborhoods (city_id, name_normalized);

CREATE OR REPLACE FUNCTION trg_neighborhoods_normalize()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS NOT NULL THEN
    NEW.name_display := NEW.name;
    NEW.name_normalized := normalize_location_name(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_neighborhoods_normalize_trigger ON neighborhoods;
CREATE TRIGGER trg_neighborhoods_normalize_trigger
  BEFORE INSERT OR UPDATE OF name ON neighborhoods
  FOR EACH ROW
  EXECUTE FUNCTION trg_neighborhoods_normalize();

COMMIT;

-- ============================================================
-- FIM 116_location_core_normalization.sql
-- ============================================================







