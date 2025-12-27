-- ============================================
-- 047_companies_system.sql
-- Sistema de empresas (PJ) com integração CRM/ERP
-- ============================================

-- Tabela de empresas
CREATE TABLE IF NOT EXISTS companies (
  company_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  
  -- Dados básicos
  cnpj VARCHAR(18) NOT NULL, -- CNPJ formatado (XX.XXX.XXX/XXXX-XX)
  company_name TEXT NOT NULL, -- Razão Social
  trade_name TEXT, -- Nome Fantasia
  registration_date DATE, -- Data de abertura
  
  -- Endereço
  cep VARCHAR(9), -- CEP formatado
  address TEXT, -- Logradouro
  address_number VARCHAR(20),
  complement TEXT,
  neighborhood TEXT, -- Bairro
  city TEXT,
  state VARCHAR(2), -- UF
  country VARCHAR(2) DEFAULT 'BR',
  
  -- Contato
  phone VARCHAR(20),
  email VARCHAR(255),
  website VARCHAR(255),
  
  -- Atividade
  main_activity_code VARCHAR(10), -- CNAE principal
  main_activity_description TEXT, -- Descrição da atividade principal
  secondary_activities JSONB DEFAULT '[]'::jsonb, -- Array de CNAEs secundários
  
  -- Dados da Receita Federal (JSONB para flexibilidade)
  revenue_data JSONB DEFAULT '{}'::jsonb, -- Dados completos da Receita Federal
  
  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'closed')),
  is_verified BOOLEAN DEFAULT false, -- Verificado pela Receita Federal
  
  -- Metadata adicional
  metadata JSONB DEFAULT '{}'::jsonb, -- Dados extras (raio X, etc.)
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT companies_cnpj_unique UNIQUE (global_user_id, cnpj)
);

-- Tabela de relacionamento usuário-empresa (cargos, permissões)
CREATE TABLE IF NOT EXISTS company_users (
  company_user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  
  -- Cargo/Função
  role VARCHAR(50) NOT NULL, -- 'owner', 'partner', 'director', 'manager', 'employee', 'other'
  role_description TEXT, -- Descrição customizada se role = 'other'
  
  -- Permissões
  can_manage_company BOOLEAN DEFAULT false, -- Pode gerenciar dados da empresa
  can_manage_financial BOOLEAN DEFAULT false, -- Pode gerenciar financeiro
  can_manage_employees BOOLEAN DEFAULT false, -- Pode gerenciar funcionários
  can_view_reports BOOLEAN DEFAULT false, -- Pode ver relatórios
  can_manage_services BOOLEAN DEFAULT false, -- Pode gerenciar serviços/produtos
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_primary BOOLEAN DEFAULT false, -- Empresa principal do usuário
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT company_users_unique UNIQUE (company_id, global_user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_companies_user ON companies (global_user_id);
CREATE INDEX IF NOT EXISTS idx_companies_cnpj ON companies (cnpj);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies (status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_company_users_company ON company_users (company_id);
CREATE INDEX IF NOT EXISTS idx_company_users_user ON company_users (global_user_id);
CREATE INDEX IF NOT EXISTS idx_company_users_active ON company_users (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_company_users_primary ON company_users (is_primary) WHERE is_primary = true;

-- Triggers para updated_at
CREATE TRIGGER trigger_update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_company_users_updated_at
  BEFORE UPDATE ON company_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE companies IS 'Empresas cadastradas pelos usuários (PJ)';
COMMENT ON COLUMN companies.revenue_data IS 'Dados completos da Receita Federal (JSONB)';
COMMENT ON COLUMN companies.metadata IS 'Dados adicionais: raio X da empresa, análises, etc.';
COMMENT ON TABLE company_users IS 'Relacionamento usuário-empresa com cargos e permissões';
COMMENT ON COLUMN company_users.role IS 'Cargo: owner (proprietário), partner (sócio), director (diretor), manager (gerente), employee (funcionário), other (outro)';
