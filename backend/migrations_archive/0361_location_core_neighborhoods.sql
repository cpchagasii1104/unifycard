-- ============================================================
-- UNIFICARD — MIGRATION 115
-- Arquivo: 115_location_core_neighborhoods.sql
-- Location Core: Adicionar suporte a bairros
-- Banco alvo: PostgreSQL 14+
--
-- OBJETIVO
-- Adicionar tabela neighborhoods ao Location Core
-- para completar a hierarquia: país → estado → cidade → bairro
--
-- ESCOPO
-- ✔ Criar tabela neighborhoods
-- ✔ Adicionar índices para performance
-- ✔ Não altera tabelas existentes
-- ✔ Não quebra funcionalidades existentes
--
-- ============================================================

BEGIN;

-- ============================================================
-- NEIGHBORHOODS (BAIRROS)
-- ============================================================

CREATE TABLE IF NOT EXISTS neighborhoods (
  neighborhood_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES cities(city_id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT neighborhoods_city_name_unique UNIQUE (city_id, name)
);

CREATE INDEX IF NOT EXISTS idx_neighborhoods_city ON neighborhoods (city_id);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_name ON neighborhoods (name);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_name_en ON neighborhoods (name_en) WHERE name_en IS NOT NULL;

DROP TRIGGER IF EXISTS trg_neighborhoods_updated_at ON neighborhoods;
CREATE TRIGGER trg_neighborhoods_updated_at
  BEFORE UPDATE ON neighborhoods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE neighborhoods IS 'Bairros vinculados a cidades';
COMMENT ON COLUMN neighborhoods.name IS 'Nome do bairro no idioma local';
COMMENT ON COLUMN neighborhoods.name_en IS 'Nome do bairro em inglês (opcional)';

-- ============================================================
-- ADICIONAR CAMPO active EM COUNTRIES (se não existir)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'countries' AND column_name = 'active'
  ) THEN
    ALTER TABLE countries ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;
    CREATE INDEX IF NOT EXISTS idx_countries_active ON countries (active) WHERE active = true;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- FIM 115_location_core_neighborhoods.sql
-- ============================================================







