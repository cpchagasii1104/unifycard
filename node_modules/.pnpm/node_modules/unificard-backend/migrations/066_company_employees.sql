-- ================================================
-- UNIFICARD - MIGRATION 066
-- Company Employees (FASE 1.4)
-- Criar Tabela de Funcionários
-- ================================================

CREATE TABLE IF NOT EXISTS company_employees (
  company_employee_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,

  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ NULL,

  role VARCHAR(20) NOT NULL DEFAULT 'staff',
    -- 'owner' | 'admin' | 'manager' | 'staff'
  can_manage_schedule BOOLEAN NOT NULL DEFAULT false,
  can_manage_services BOOLEAN NOT NULL DEFAULT false,

  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_role CHECK (role IN ('owner', 'admin', 'manager', 'staff')),
  CONSTRAINT valid_dates CHECK (ended_at IS NULL OR ended_at > started_at)
);

-- Índice para vínculos ativos
CREATE INDEX idx_company_employees_active 
  ON company_employees(company_id, ended_at)
  WHERE ended_at IS NULL;

-- Índice para histórico
CREATE INDEX idx_company_employees_user 
  ON company_employees(global_user_id, started_at DESC);

-- RLS
ALTER TABLE company_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON company_employees
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Trigger para updated_at
CREATE TRIGGER trigger_update_company_employees_updated_at
  BEFORE UPDATE ON company_employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE company_employees IS 'Funcionários de empresas com controle de agenda e serviços';
COMMENT ON COLUMN company_employees.role IS 'Cargo: owner, admin, manager, staff';
COMMENT ON COLUMN company_employees.ended_at IS 'NULL = ativo, preenchido = demitido';















