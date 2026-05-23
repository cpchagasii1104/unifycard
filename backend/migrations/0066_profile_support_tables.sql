-- ============================================================
-- 0066: Suporte mínimo a profile/core (GENESIS + contrato do código)
-- ============================================================
-- user_profiles, users.referral_code, companies (colunas usadas em core.service),
-- company_validations (progresso / validação presencial).
-- ============================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- user_profiles
-- ---------------------------------------------------------------------------
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  cpf TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- users.referral_code (core.service)
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- ---------------------------------------------------------------------------
-- companies — apenas colunas usadas pelo código
-- ---------------------------------------------------------------------------
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS global_user_id UUID REFERENCES global_users (global_user_id),
  ADD COLUMN IF NOT EXISTS cnpj TEXT,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- ---------------------------------------------------------------------------
-- company_validations
-- ---------------------------------------------------------------------------
CREATE TABLE company_validations (
  validation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies (company_id) ON DELETE CASCADE,
  validation_method TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMIT;
