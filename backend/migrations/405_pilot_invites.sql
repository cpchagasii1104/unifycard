-- ============================================================
-- UNIFICARD - MIGRATION 157
-- SPRINT 14: Piloto Humano Controlado
-- Tabela: pilot_invites
-- ============================================================
--
-- OBJETIVO:
-- Criar tabela para gerenciar convites de usuários para o modo piloto.
-- Permite controle explícito de quem pode entrar no sistema.
--
-- REGRAS:
-- - Apenas usuários com permission invite_pilot_user podem convidar
-- - Convites expiram em 7 dias
-- - Convite só cria conta ao ser aceito
-- ============================================================

-- ============================================================
-- TABELA: pilot_invites
-- ============================================================
CREATE TABLE IF NOT EXISTS pilot_invites (
    -- Identificação
    invite_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Email do convidado
    email VARCHAR(255) NOT NULL,
    
    -- Usuário que enviou o convite
    invited_by_user_id UUID NOT NULL
        REFERENCES users(user_id) ON DELETE CASCADE,
    
    -- Status do convite
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    
    -- Timestamps
    invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    
    -- Metadata opcional
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamp de criação
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pilot_invites_tenant_id 
    ON pilot_invites(tenant_id);

CREATE INDEX IF NOT EXISTS idx_pilot_invites_email 
    ON pilot_invites(email);

CREATE INDEX IF NOT EXISTS idx_pilot_invites_status 
    ON pilot_invites(status);

CREATE INDEX IF NOT EXISTS idx_pilot_invites_expires_at 
    ON pilot_invites(expires_at);

-- Índice composto para consultas comuns
CREATE INDEX IF NOT EXISTS idx_pilot_invites_tenant_email_status 
    ON pilot_invites(tenant_id, email, status);

-- Índice único para evitar convites duplicados pendentes
CREATE UNIQUE INDEX IF NOT EXISTS idx_pilot_invites_unique_pending 
    ON pilot_invites(tenant_id, email) 
    WHERE status = 'pending';

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE pilot_invites IS 
    'Convites para entrada no modo piloto - controle explícito de acesso';

COMMENT ON COLUMN pilot_invites.email IS 
    'Email do usuário convidado (deve ser único para convites pendentes)';

COMMENT ON COLUMN pilot_invites.status IS 
    'Status do convite: pending, accepted, revoked, expired';

COMMENT ON COLUMN pilot_invites.expires_at IS 
    'Data de expiração do convite (7 dias após criação)';







