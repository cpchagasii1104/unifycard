-- ============================================================
-- UNIFICARD - MIGRATION 214
-- SPRINT 78: CONVITES, PAPÉIS E GOVERNANÇA ORGANIZACIONAL
-- Tabela: organization_members
-- ============================================================
--
-- OBJETIVO:
-- Criar vínculo entre usuário e organização com papel.
--
-- REGRAS:
-- - Aceite exige aceite explícito
-- - Sem aceite = sem acesso
-- - Um usuário pode pertencer a várias organizações
-- - Tudo explícito e auditável
-- ============================================================

-- ============================================================
-- ENUM: Organization Member Status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_member_status') THEN
    CREATE TYPE organization_member_status AS ENUM (
      'ACTIVE',    -- Ativo
      'SUSPENDED'  -- Suspenso
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: organization_members
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_members (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Usuário
    actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    user_id UUID NOT NULL
        REFERENCES users(user_id) ON DELETE CASCADE,
    
    -- Papel
    role_id UUID NOT NULL
        REFERENCES organization_roles(id) ON DELETE RESTRICT,
    
    -- Status
    status organization_member_status NOT NULL DEFAULT 'ACTIVE',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT organization_members_unique UNIQUE (tenant_id, actor_id, user_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_organization_members_tenant_id
    ON organization_members(tenant_id);

-- Índice para buscar por actor
CREATE INDEX IF NOT EXISTS idx_organization_members_actor
    ON organization_members(tenant_id, actor_id);

-- Índice para buscar por user
CREATE INDEX IF NOT EXISTS idx_organization_members_user
    ON organization_members(tenant_id, user_id);

-- Índice para buscar por role
CREATE INDEX IF NOT EXISTS idx_organization_members_role
    ON organization_members(tenant_id, role_id);

-- Índice para buscar ativos
CREATE INDEX IF NOT EXISTS idx_organization_members_active
    ON organization_members(tenant_id, status)
    WHERE status = 'ACTIVE';

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem members do próprio tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'organization_members'
      AND policyname = 'organization_members_tenant_isolation'
  ) THEN
    CREATE POLICY organization_members_tenant_isolation
      ON organization_members
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- TRIGGERS
-- ============================================================
-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_organization_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_organization_members_updated_at
    BEFORE UPDATE ON organization_members
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_members_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE organization_members IS 'Membros da organização. Aceite exige aceite explícito. Sem aceite = sem acesso.';
COMMENT ON COLUMN organization_members.actor_id IS 'Actor do usuário (pode ser company actor)';
COMMENT ON COLUMN organization_members.user_id IS 'Usuário (user_id)';
COMMENT ON COLUMN organization_members.status IS 'Status: ACTIVE, SUSPENDED';


