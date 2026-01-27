-- ============================================================
-- UNIFICARD — MIGRATION 066
-- Arquivo: 066_company_employees.sql
-- Tipo: ESTRUTURAL / GOVERNANÇA ORGANIZACIONAL
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Esta migration introduz o vínculo formal entre empresas
-- e usuários globais, representando funcionários, gestores
-- e proprietários dentro de uma organização.
--
-- O modelo suporta:
-- • histórico de vínculos (entrada/saída)
-- • controle de permissões operacionais básicas
-- • integração com agenda e serviços
--
-- GOVERNANÇA
-- • Um usuário pode ter múltiplos vínculos históricos
-- • Um usuário pode ter APENAS um vínculo ativo por empresa
-- • Roles organizacionais NÃO substituem RBAC global
--
-- RLS
-- • Isolamento por tenant
-- • Visibilidade completa dentro do tenant (decisão consciente)
-- • Restrições por empresa/role são aplicadas no serviço
--
-- IDEMPOTÊNCIA
-- • IF NOT EXISTS em todas as estruturas
-- • Índices únicos parciais para regras críticas
--
-- DEPENDÊNCIAS
-- • tenants
-- • companies
-- • global_users
-- • update_updated_at_column()
-- • extensão pgcrypto
--
-- ============================================================


-- ============================================================
-- EXTENSÕES
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- 1) COMPANY EMPLOYEES
-- ============================================================

CREATE TABLE IF NOT EXISTS company_employees (
  company_employee_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id)
    ON DELETE CASCADE,

  company_id UUID NOT NULL
    REFERENCES companies(company_id)
    ON DELETE CASCADE,

  global_user_id UUID NOT NULL
    REFERENCES global_users(global_user_id)
    ON DELETE CASCADE,

  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,

  role VARCHAR(20) NOT NULL DEFAULT 'staff',
  -- owner | admin | manager | staff

  can_manage_schedule BOOLEAN NOT NULL DEFAULT false,
  can_manage_services BOOLEAN NOT NULL DEFAULT false,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT company_employees_role_check
    CHECK (role IN ('owner', 'admin', 'manager', 'staff')),

  CONSTRAINT company_employees_valid_dates
    CHECK (ended_at IS NULL OR ended_at > started_at)
);


-- ============================================================
-- 2) UNICIDADE DE VÍNCULO ATIVO
-- ============================================================

-- Um usuário só pode ter UM vínculo ativo por empresa
CREATE UNIQUE INDEX IF NOT EXISTS uniq_company_employee_active
  ON company_employees (company_id, global_user_id)
  WHERE ended_at IS NULL;


-- ============================================================
-- 3) ÍNDICES DE CONSULTA
-- ============================================================

-- Funcionários ativos por empresa
CREATE INDEX IF NOT EXISTS idx_company_employees_active
  ON company_employees (company_id, ended_at)
  WHERE ended_at IS NULL;

-- Histórico de vínculos do usuário
CREATE INDEX IF NOT EXISTS idx_company_employees_user_history
  ON company_employees (global_user_id, started_at DESC);


-- ============================================================
-- 4) RLS (ROW LEVEL SECURITY)
-- ============================================================

ALTER TABLE company_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_employees_tenant_rls
  ON company_employees
  USING (tenant_id::text = current_setting('app.current_tenant', true));


-- ============================================================
-- 5) TRIGGER updated_at
-- ============================================================

CREATE TRIGGER trg_company_employees_updated_at
  BEFORE UPDATE ON company_employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- COMENTÁRIOS
-- ============================================================

COMMENT ON TABLE company_employees IS
  'Vínculo entre empresas e usuários globais (histórico de funcionários)';

COMMENT ON COLUMN company_employees.role IS
  'Cargo organizacional: owner, admin, manager ou staff';

COMMENT ON COLUMN company_employees.ended_at IS
  'NULL indica vínculo ativo; preenchido indica desligamento';


-- ============================================================
-- FIM 066_company_employees.sql
-- ============================================================













