-- ============================================================
-- UNIFICARD — MIGRATION 117
-- Arquivo: 117_location_core_addresses.sql
-- Location Core: Tabela genérica de endereços
-- Banco alvo: PostgreSQL 14+
--
-- OBJETIVO
-- Criar tabela addresses genérica que será referenciada por:
-- - users
-- - companies
-- - groups
-- - events
-- - votings
-- - schools
-- - qualquer módulo futuro
--
-- ESCOPO
-- ✔ Criar tabela addresses
-- ✔ Adicionar campos de localização (lat/lng)
-- ✔ Criar índices para busca geográfica
-- ✔ Não altera tabelas existentes
-- ✔ Permite migração gradual
--
-- ============================================================

BEGIN;

-- ============================================================
-- TABELA ADDRESSES (GENÉRICA)
-- ============================================================

CREATE TABLE IF NOT EXISTS addresses (
  address_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Localização normalizada (referências ao Location Core)
  country_id UUID REFERENCES countries(country_id) ON DELETE RESTRICT,
  state_id UUID REFERENCES states(state_id) ON DELETE RESTRICT,
  city_id UUID REFERENCES cities(city_id) ON DELETE RESTRICT,
  neighborhood_id UUID REFERENCES neighborhoods(neighborhood_id) ON DELETE RESTRICT,
  
  -- Dados do endereço (texto livre, não normalizado)
  street TEXT,
  number VARCHAR(20),
  complement TEXT,
  postal_code VARCHAR(20), -- CEP ou código postal
  
  -- Coordenadas geográficas (opcional)
  latitude NUMERIC(10, 8) CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC(11, 8) CHECK (longitude BETWEEN -180 AND 180),
  
  -- Status e validação
  status VARCHAR(20) NOT NULL DEFAULT 'validated' 
    CHECK (status IN ('validated', 'pending_validation', 'invalid')),
  
  -- Metadata
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_addresses_country ON addresses (country_id) WHERE country_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_addresses_state ON addresses (state_id) WHERE state_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_addresses_city ON addresses (city_id) WHERE city_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_addresses_neighborhood ON addresses (neighborhood_id) WHERE neighborhood_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_addresses_postal_code ON addresses (postal_code) WHERE postal_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_addresses_status ON addresses (status) WHERE status = 'pending_validation';

-- Índice geográfico (para busca por proximidade)
CREATE INDEX IF NOT EXISTS idx_addresses_location 
  ON addresses (latitude, longitude) 
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trg_addresses_updated_at ON addresses;
CREATE TRIGGER trg_addresses_updated_at
  BEFORE UPDATE ON addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE addresses IS 'Endereços genéricos referenciados por users, companies, groups, events, etc.';
COMMENT ON COLUMN addresses.status IS 'validated = validado, pending_validation = criado via CEP aguardando validação, invalid = inválido';
COMMENT ON COLUMN addresses.postal_code IS 'CEP (Brasil) ou código postal (outros países)';

COMMIT;

-- ============================================================
-- FIM 117_location_core_addresses.sql
-- ============================================================







