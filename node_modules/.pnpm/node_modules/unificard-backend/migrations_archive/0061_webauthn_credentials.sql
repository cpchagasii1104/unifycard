-- ============================================================
-- UNIFICARD - MIGRATION 162
-- SPRINT 36.3: BANK SAFETY LAYER - WebAuthn Credentials
-- Tabela: webauthn_credentials
-- ============================================================
--
-- OBJETIVO:
-- Armazenar credenciais WebAuthn/Passkeys para step-up authentication.
-- Este é SCAFFOLDING REALISTA - exige credencial registrada para enforcement real.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Credenciais são opcionais (sistema funciona sem elas)
-- - Step-up só é exigido se credencial estiver registrada
-- - Não criar falsa sensação de segurança
-- ============================================================

-- ============================================================
-- TABELA: webauthn_credentials
-- ============================================================
CREATE TABLE IF NOT EXISTS webauthn_credentials (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Usuário que possui a credencial
    user_id UUID NOT NULL,
    
    -- Credential ID (retornado pelo authenticator)
    credential_id TEXT NOT NULL,
    
    -- Public Key (armazenada após registro)
    public_key TEXT NOT NULL,
    
    -- Counter (para prevenir replay attacks)
    counter BIGINT NOT NULL DEFAULT 0,
    
    -- Nome amigável da credencial (ex: "iPhone 12", "YubiKey")
    friendly_name VARCHAR(100),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraint: uma credencial por credential_id
    CONSTRAINT unique_credential_id UNIQUE (credential_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar credenciais por usuário
CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user
    ON webauthn_credentials (tenant_id, user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE webauthn_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY webauthn_credentials_rls ON webauthn_credentials
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE webauthn_credentials IS
    'Credenciais WebAuthn/Passkeys para step-up authentication. Sistema funciona sem credenciais registradas.';

COMMENT ON COLUMN webauthn_credentials.credential_id IS
    'ID único da credencial (retornado pelo authenticator durante registro)';

COMMENT ON COLUMN webauthn_credentials.public_key IS
    'Chave pública da credencial (armazenada após registro bem-sucedido)';

COMMENT ON COLUMN webauthn_credentials.counter IS
    'Contador para prevenir replay attacks (incrementa a cada uso)';

-- ============================================================
-- TABELA: webauthn_challenges (temporária, em memória/cache)
-- ============================================================
-- Nota: Esta tabela é para armazenar challenges temporários
-- Em produção, considere usar Redis ou cache em memória
CREATE TABLE IF NOT EXISTS webauthn_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Usuário que solicitou o challenge
    user_id UUID NOT NULL,
    
    -- Challenge (random bytes, base64)
    challenge TEXT NOT NULL,
    
    -- Timestamp de expiração (5 minutos)
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índice para limpeza de challenges expirados
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expires
    ON webauthn_challenges (expires_at);

-- RLS para challenges
ALTER TABLE webauthn_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY webauthn_challenges_rls ON webauthn_challenges
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Função para limpar challenges expirados (pode ser chamada periodicamente)
CREATE OR REPLACE FUNCTION cleanup_expired_webauthn_challenges()
RETURNS void AS $$
BEGIN
    DELETE FROM webauthn_challenges WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;







