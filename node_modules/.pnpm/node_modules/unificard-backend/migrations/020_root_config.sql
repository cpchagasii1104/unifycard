-- ================================================
-- UNIFICARD - MIGRATION 020
-- Root Config: Configuração-raiz do sistema
-- Sistema global (não multi-tenant)
-- ================================================

-- ===========================
-- ROOT CONFIG
-- ===========================
CREATE TABLE IF NOT EXISTS root_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID REFERENCES countries(country_id) ON DELETE SET NULL,
  state_id UUID REFERENCES states(state_id) ON DELETE SET NULL,
  city_id UUID REFERENCES cities(city_id) ON DELETE SET NULL,
  timezone TEXT,
  currency VARCHAR(3), -- ISO 4217 (ex: BRL, USD, EUR)
  languages TEXT[] DEFAULT ARRAY[]::TEXT[], -- ISO 639-1 (ex: ['pt', 'en'])
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_root_config CHECK (
    (SELECT COUNT(*) FROM root_config) <= 1
  )
);

-- Garantir que só existe uma configuração-raiz
CREATE UNIQUE INDEX IF NOT EXISTS idx_root_config_single ON root_config ((1));

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_root_config_country ON root_config (country_id) WHERE country_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_root_config_state ON root_config (state_id) WHERE state_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_root_config_city ON root_config (city_id) WHERE city_id IS NOT NULL;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_root_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_root_config_updated_at
  BEFORE UPDATE ON root_config
  FOR EACH ROW
  EXECUTE FUNCTION update_root_config_updated_at();

-- ===========================
-- COMENTÁRIOS
-- ===========================
COMMENT ON TABLE root_config IS 'Configuração-raiz do sistema Unificard (global, não multi-tenant)';
COMMENT ON COLUMN root_config.country_id IS 'País padrão do sistema';
COMMENT ON COLUMN root_config.state_id IS 'Estado padrão do sistema';
COMMENT ON COLUMN root_config.city_id IS 'Cidade padrão do sistema (ex: Cidade Nova)';
COMMENT ON COLUMN root_config.timezone IS 'Timezone padrão (ex: America/Sao_Paulo)';
COMMENT ON COLUMN root_config.currency IS 'Moeda padrão (ISO 4217, ex: BRL)';
COMMENT ON COLUMN root_config.languages IS 'Idiomas suportados (ISO 639-1, ex: [pt, en])';








