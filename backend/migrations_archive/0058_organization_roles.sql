-- ============================================================
-- UNIFICARD - MIGRATION 213
-- SPRINT 78: CONVITES, PAPÉIS E GOVERNANÇA ORGANIZACIONAL
-- Tabela: organization_roles
-- ============================================================
--
-- OBJETIVO:
-- Criar papéis organizacionais para governança entre empresa, gestor e operador.
--
-- REGRAS:
-- - Papéis controlam permissões (integra com permission system existente)
-- - Tudo explícito e auditável
-- - Sem criar permissões mágicas
-- ============================================================

-- ============================================================
-- ENUM: Organization Role Key
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_role_key') THEN
    CREATE TYPE organization_role_key AS ENUM (
      'OWNER',     -- Proprietário
      'ADMIN',     -- Administrador
      'MANAGER',   -- Gestor
      'OPERATOR',  -- Operador
      'FINANCE'    -- Financeiro
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: organization_roles
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_roles (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Papel
    role_key organization_role_key NOT NULL,
    description TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT organization_roles_unique UNIQUE (tenant_id, role_key)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_organization_roles_tenant_id
    ON organization_roles(tenant_id);

-- Índice para buscar por role_key
CREATE INDEX IF NOT EXISTS idx_organization_roles_role_key
    ON organization_roles(tenant_id, role_key);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE organization_roles ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem roles do próprio tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'organization_roles'
      AND policyname = 'organization_roles_tenant_isolation'
  ) THEN
    CREATE POLICY organization_roles_tenant_isolation
      ON organization_roles
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- DADOS INICIAIS (System Roles)
-- ============================================================
-- Inserir roles padrão para cada tenant existente
DO $$
DECLARE
    tenant_record RECORD;
BEGIN
    FOR tenant_record IN SELECT tenant_id FROM tenants
    LOOP
        -- Inserir roles padrão se não existirem
        INSERT INTO organization_roles (tenant_id, role_key, description)
        VALUES
            (tenant_record.tenant_id, 'OWNER', 'Proprietário da organização'),
            (tenant_record.tenant_id, 'ADMIN', 'Administrador com acesso total'),
            (tenant_record.tenant_id, 'MANAGER', 'Gestor com acesso operacional'),
            (tenant_record.tenant_id, 'OPERATOR', 'Operador com acesso limitado'),
            (tenant_record.tenant_id, 'FINANCE', 'Acesso financeiro')
        ON CONFLICT (tenant_id, role_key) DO NOTHING;
    END LOOP;
END$$;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE organization_roles IS 'Papéis organizacionais para governança. Papéis controlam permissões (integra com permission system existente).';
COMMENT ON COLUMN organization_roles.role_key IS 'Chave do papel: OWNER, ADMIN, MANAGER, OPERATOR, FINANCE';


