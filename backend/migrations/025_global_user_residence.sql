-- ================================================
-- UNIFICARD - MIGRATION 025
-- Digital Residence System (Cidade Nova)
-- Residência digital de cada usuário global
-- ================================================

-- ===========================
-- GLOBAL USER RESIDENCE
-- ===========================
CREATE TABLE IF NOT EXISTS global_user_residence (
  global_user_id UUID PRIMARY KEY REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  country_id UUID REFERENCES countries(country_id) ON DELETE SET NULL,
  state_id UUID REFERENCES states(state_id) ON DELETE SET NULL,
  city_id UUID REFERENCES cities(city_id) ON DELETE SET NULL,
  timezone TEXT,
  currency VARCHAR(3) DEFAULT 'BRL', -- ISO 4217
  languages TEXT[] DEFAULT ARRAY[]::TEXT[], -- ISO 639-1
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_residence_country ON global_user_residence (country_id) WHERE country_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_residence_state ON global_user_residence (state_id) WHERE state_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_residence_city ON global_user_residence (city_id) WHERE city_id IS NOT NULL;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_global_user_residence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_global_user_residence_updated_at
  BEFORE UPDATE ON global_user_residence
  FOR EACH ROW
  EXECUTE FUNCTION update_global_user_residence_updated_at();

-- ===========================
-- COMENTÁRIOS
-- ===========================
COMMENT ON TABLE global_user_residence IS 'Residência digital de cada usuário global (Cidade Nova)';
COMMENT ON COLUMN global_user_residence.global_user_id IS 'Usuário global dono desta residência digital';
COMMENT ON COLUMN global_user_residence.country_id IS 'País da residência digital (opcional)';
COMMENT ON COLUMN global_user_residence.state_id IS 'Estado da residência digital (opcional)';
COMMENT ON COLUMN global_user_residence.city_id IS 'Cidade da residência digital (opcional)';
COMMENT ON COLUMN global_user_residence.timezone IS 'Timezone da residência digital (ex: America/Sao_Paulo)';
COMMENT ON COLUMN global_user_residence.currency IS 'Moeda preferida da residência digital (ISO 4217)';
COMMENT ON COLUMN global_user_residence.languages IS 'Idiomas preferidos da residência digital (ISO 639-1)';








