-- ============================================================
-- UNIFICARD — COMPANY MEMBERS (BASE ESTRUTURAL)
-- Arquivo: 147_company_members.sql
-- Banco alvo: PostgreSQL 14+
--
-- OBJETIVO
-- Criar base estrutural para equipes, funcionários e delegação
-- SEM implementar CRM ou ERP completo
--
-- REGRAS CANÔNICAS:
-- * Funcionários são actors CPF independentes
-- * Empresa pode atribuir compromissos (availability) a funcionários
-- * Conflitos de agenda são detectados (alerta, não bloqueio)
-- * Empresa NÃO pode editar agenda pessoal do funcionário
--
-- ============================================================

BEGIN;

-- ============================================================
-- ENUMS CANÔNICOS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'company_member_role') THEN
    CREATE TYPE company_member_role AS ENUM (
      'admin',      -- Administrador
      'staff',      -- Funcionário
      'contractor'  -- Contratado/Prestador
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'company_member_status') THEN
    CREATE TYPE company_member_status AS ENUM (
      'active',     -- Ativo
      'invited',    -- Convidado (aguardando aceite)
      'suspended'   -- Suspenso
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: COMPANY_MEMBERS
-- ============================================================

CREATE TABLE IF NOT EXISTS company_members (
  member_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Relacionamentos OBRIGATÓRIOS
  -- 🔴 BLINDAGEM: company_id referencia companies (empresa)
  -- 🔴 BLINDAGEM: actor_id referencia actors (CPF - actor_type = 'user')
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES actors(actor_id) ON DELETE CASCADE,
  
  -- Papel e Status
  role company_member_role NOT NULL DEFAULT 'staff',
  status company_member_status NOT NULL DEFAULT 'invited',
  
  -- Metadados e Extensibilidade
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  -- 🔴 BLINDAGEM: Apenas um membro ativo por empresa para o mesmo actor
  CONSTRAINT company_members_unique_per_company_actor UNIQUE (company_id, actor_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_company_members_company_id ON company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_actor_id ON company_members(actor_id);
CREATE INDEX IF NOT EXISTS idx_company_members_tenant_id ON company_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_company_members_status ON company_members(status);
CREATE INDEX IF NOT EXISTS idx_company_members_role ON company_members(role);

-- Índice composto para busca de membros ativos por empresa
CREATE INDEX IF NOT EXISTS idx_company_members_company_status 
  ON company_members(company_id, status)
  WHERE status = 'active';

-- ============================================================
-- TRIGGER: UPDATE updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_company_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_company_members_updated_at
  BEFORE UPDATE ON company_members
  FOR EACH ROW
  EXECUTE FUNCTION update_company_members_updated_at();

-- ============================================================
-- RLS (ROW LEVEL SECURITY)
-- ============================================================

ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_members_tenant_rls
  ON company_members
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- COMENTÁRIOS
-- ============================================================

COMMENT ON TABLE company_members IS
  'Membros de empresa (funcionários, contratados) - Base estrutural para equipes e delegação';

COMMENT ON COLUMN company_members.company_id IS
  'Empresa (company_id)';

COMMENT ON COLUMN company_members.actor_id IS
  'Actor CPF (actor_type = ''user'') - Funcionário como actor independente';

COMMENT ON COLUMN company_members.role IS
  'Papel do membro: admin, staff, contractor';

COMMENT ON COLUMN company_members.status IS
  'Status do membro: active, invited, suspended';

-- ============================================================
-- FIM 147_company_members.sql
-- ============================================================

COMMIT;

