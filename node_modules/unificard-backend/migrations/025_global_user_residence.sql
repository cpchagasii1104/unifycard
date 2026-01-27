/*
Arquivo: 025_global_user_residence.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Escopo: Sistema de Residência Digital (Cidade Nova)

Objetivo:
- Definir residência digital única por usuário global
- Base para preferências regionais, moeda, idioma e timezone
- Escopo global (não multi-tenant)

Dependências:
- global_users (022_global_identity.sql)
- countries, states, cities (019_world_geography.sql)

Regras:
- 1 registro por usuário global
- Idiomas obrigatórios (array não pode ser vazio)
*/

-- =========================================================
-- TABELA: GLOBAL USER RESIDENCE
-- =========================================================

CREATE TABLE IF NOT EXISTS global_user_residence (
  global_user_id UUID PRIMARY KEY
    REFERENCES global_users(global_user_id)
    ON DELETE CASCADE,

  country_id UUID
    REFERENCES countries(country_id)
    ON DELETE SET NULL,

  state_id UUID
    REFERENCES states(state_id)
    ON DELETE SET NULL,

  city_id UUID
    REFERENCES cities(city_id)
    ON DELETE SET NULL,

  timezone TEXT,
  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
  languages TEXT[] NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Sanidade real (não cosmética)
  CONSTRAINT global_user_residence_currency_chk
    CHECK (currency ~ '^[A-Z]{3}$'),

  CONSTRAINT global_user_residence_languages_chk
    CHECK (cardinality(languages) >= 1)
);

-- =========================================================
-- ÍNDICES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_global_user_residence_country
  ON global_user_residence (country_id)
  WHERE country_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_global_user_residence_state
  ON global_user_residence (state_id)
  WHERE state_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_global_user_residence_city
  ON global_user_residence (city_id)
  WHERE city_id IS NOT NULL;

-- =========================================================
-- TRIGGER updated_at (padrão do projeto)
-- =========================================================

DROP TRIGGER IF EXISTS trg_global_user_residence_updated_at
  ON global_user_residence;

CREATE TRIGGER trg_global_user_residence_updated_at
  BEFORE UPDATE ON global_user_residence
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- COMENTÁRIOS
-- =========================================================

COMMENT ON TABLE global_user_residence IS
  'Residência digital única do usuário global (Cidade Nova)';

COMMENT ON COLUMN global_user_residence.languages IS
  'Idiomas preferidos (ISO 639-1). Deve conter ao menos um valor';








