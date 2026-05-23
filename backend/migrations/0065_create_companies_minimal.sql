-- ============================================================
-- 0065: companies + company_users (mínimo viável GENESIS)
-- ============================================================
-- Objetivo: tabelas esperadas por actor.repository / social sem importar archive.
-- company_users usa global_user_id (não só user_id) para alinhar ao JOIN existente:
--   cu.global_user_id = u.global_user_id (actor.repository.ts)
-- ============================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- companies (mínimo)
-- ---------------------------------------------------------------------------
CREATE TABLE companies (
  company_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,

  company_name TEXT NOT NULL,
  trade_name TEXT,

  status TEXT NOT NULL DEFAULT 'active',
  company_status TEXT NOT NULL DEFAULT 'ACTIVE',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_companies_tenant_id ON companies (tenant_id);
CREATE INDEX idx_companies_status ON companies (status);
CREATE INDEX idx_companies_company_status ON companies (company_status);

-- ---------------------------------------------------------------------------
-- company_users (mínimo + colunas exigidas pelo SQL social existente)
-- ---------------------------------------------------------------------------
CREATE TABLE company_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies (company_id) ON DELETE CASCADE,

  global_user_id UUID NOT NULL REFERENCES global_users (global_user_id) ON DELETE CASCADE,

  role TEXT NOT NULL DEFAULT 'member',
  can_manage_company BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_primary BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_company_users_company_global_user
  ON company_users (company_id, global_user_id);

CREATE INDEX idx_company_users_company ON company_users (company_id);
CREATE INDEX idx_company_users_global_user ON company_users (global_user_id);
CREATE INDEX idx_company_users_tenant ON company_users (tenant_id);

COMMIT;
