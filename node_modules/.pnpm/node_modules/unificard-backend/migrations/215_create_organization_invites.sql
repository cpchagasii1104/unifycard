-- ============================================================
-- UNIFICARD - MIGRATION 215
-- SPRINT 78: CONVITES, PAPÉIS E GOVERNANÇA ORGANIZACIONAL
-- Tabela: organization_invites
-- ============================================================
--
-- OBJETIVO:
-- Criar sistema de convites para organizações.
--
-- REGRAS:
-- - Apenas OWNER ou ADMIN pode convidar
-- - Convite exige aceite explícito
-- - Aceite cria vínculo usuário ↔ organização
-- - Sem aceite = sem acesso
-- - Tudo explícito e auditável
-- ============================================================

-- ============================================================
-- ENUM: Organization Invite Status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_invite_status') THEN
    CREATE TYPE organization_invite_status AS ENUM (
      'PENDING',   -- Pendente
      'ACCEPTED',  -- Aceito
      'REJECTED',  -- Rejeitado
      'EXPIRED'    -- Expirado
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: organization_invites
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_invites (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Email do convidado
    email VARCHAR(255) NOT NULL,
    
    -- Papel
    role_id UUID NOT NULL
        REFERENCES organization_roles(id) ON DELETE RESTRICT,
    
    -- Quem convidou
    invited_by_user_id UUID NOT NULL
        REFERENCES users(user_id) ON DELETE CASCADE,
    
    -- Status
    status organization_invite_status NOT NULL DEFAULT 'PENDING',
    
    -- Token para aceite
    token VARCHAR(255) NOT NULL UNIQUE,
    
    -- Expiração
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT check_email_not_empty CHECK (LENGTH(TRIM(email)) > 0),
    CONSTRAINT check_token_not_empty CHECK (LENGTH(TRIM(token)) > 0)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_organization_invites_tenant_id
    ON organization_invites(tenant_id);

-- Índice para buscar por email
CREATE INDEX IF NOT EXISTS idx_organization_invites_email
    ON organization_invites(tenant_id, email);

-- Índice para buscar por token
CREATE INDEX IF NOT EXISTS idx_organization_invites_token
    ON organization_invites(token);

-- Índice para buscar por status
CREATE INDEX IF NOT EXISTS idx_organization_invites_status
    ON organization_invites(tenant_id, status);

-- Índice para buscar pendentes
CREATE INDEX IF NOT EXISTS idx_organization_invites_pending
    ON organization_invites(tenant_id, status, expires_at)
    WHERE status = 'PENDING';

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem invites do próprio tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'organization_invites'
      AND policyname = 'organization_invites_tenant_isolation'
  ) THEN
    CREATE POLICY organization_invites_tenant_isolation
      ON organization_invites
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE organization_invites IS 'Convites para organizações. Convite exige aceite explícito. Sem aceite = sem acesso.';
COMMENT ON COLUMN organization_invites.token IS 'Token único para aceite do convite';
COMMENT ON COLUMN organization_invites.expires_at IS 'Data de expiração do convite (padrão: 7 dias)';


