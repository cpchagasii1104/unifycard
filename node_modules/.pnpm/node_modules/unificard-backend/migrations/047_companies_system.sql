-- ============================================================
-- UNIFICARD — MIGRATION 047 (CORRIGIDA)
-- Arquivo: 047_companies_system.sql
-- Banco alvo: PostgreSQL 14+
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1) TABELA companies
-- ============================================================

CREATE TABLE IF NOT EXISTS companies (
  company_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  global_user_id UUID NOT NULL
    REFERENCES global_users(global_user_id)
    ON DELETE CASCADE,

  -- Dados legais (NORMALIZADOS)
  cnpj VARCHAR(14) NOT NULL,
  company_name TEXT NOT NULL,
  trade_name TEXT,
  registration_date DATE,

  -- Endereço
  cep VARCHAR(8),
  address TEXT,
  address_number VARCHAR(20),
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  state CHAR(2),
  country CHAR(2) NOT NULL DEFAULT 'BR',

  -- Contato
  phone VARCHAR(20),
  email VARCHAR(255),
  website VARCHAR(255),

  -- Atividade econômica
  main_activity_code VARCHAR(10),
  main_activity_description TEXT,
  secondary_activities JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Dados externos
  revenue_data JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'suspended', 'closed')),

  is_verified BOOLEAN NOT NULL DEFAULT false,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ✅ CNPJ SOMENTE NÚMEROS
  CONSTRAINT companies_cnpj_digits_only
    CHECK (cnpj ~ '^[0-9]{14}$'),

  CONSTRAINT companies_country_code_format
    CHECK (country ~ '^[A-Z]{2}$'),

  CONSTRAINT companies_unique_user_cnpj
    UNIQUE (global_user_id, cnpj)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_companies_user
  ON companies (global_user_id);

CREATE INDEX IF NOT EXISTS idx_companies_cnpj
  ON companies (cnpj);

CREATE INDEX IF NOT EXISTS idx_companies_status_active
  ON companies (status)
  WHERE status = 'active';

-- ============================================================
-- 2) TABELA company_users
-- ============================================================

CREATE TABLE IF NOT EXISTS company_users (
  company_user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  company_id UUID NOT NULL
    REFERENCES companies(company_id)
    ON DELETE CASCADE,

  global_user_id UUID NOT NULL
    REFERENCES global_users(global_user_id)
    ON DELETE CASCADE,

  role VARCHAR(50) NOT NULL
    CHECK (role IN ('owner','partner','director','manager','employee','other')),

  role_description TEXT,

  can_manage_company BOOLEAN NOT NULL DEFAULT false,
  can_manage_financial BOOLEAN NOT NULL DEFAULT false,
  can_manage_employees BOOLEAN NOT NULL DEFAULT false,
  can_view_reports BOOLEAN NOT NULL DEFAULT false,
  can_manage_services BOOLEAN NOT NULL DEFAULT false,

  is_active BOOLEAN NOT NULL DEFAULT true,
  is_primary BOOLEAN NOT NULL DEFAULT false,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT company_users_unique
    UNIQUE (company_id, global_user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_company_users_company
  ON company_users (company_id);

CREATE INDEX IF NOT EXISTS idx_company_users_user
  ON company_users (global_user_id);

CREATE INDEX IF NOT EXISTS idx_company_users_active
  ON company_users (is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_company_users_primary
  ON company_users (is_primary)
  WHERE is_primary = true;

-- ============================================================
-- 3) RLS companies
-- ============================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'companies'
      AND policyname = 'companies_rls'
  ) THEN
    CREATE POLICY companies_rls
      ON companies
      USING (
        global_user_id::text = current_setting('app.current_user', true)
        OR EXISTS (
          SELECT 1 FROM company_users cu
          WHERE cu.company_id = companies.company_id
            AND cu.global_user_id::text = current_setting('app.current_user', true)
            AND cu.is_active = true
        )
      );
  END IF;
END $$;

-- ============================================================
-- 4) RLS company_users
-- ============================================================

ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'company_users'
      AND policyname = 'company_users_rls'
  ) THEN
    CREATE POLICY company_users_rls
      ON company_users
      USING (
        global_user_id::text = current_setting('app.current_user', true)
      );
  END IF;
END $$;

-- ============================================================
-- 5) TRIGGERS updated_at
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_companies_updated_at'
  ) THEN
    CREATE TRIGGER trg_companies_updated_at
      BEFORE UPDATE ON companies
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_company_users_updated_at'
  ) THEN
    CREATE TRIGGER trg_company_users_updated_at
      BEFORE UPDATE ON company_users
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
