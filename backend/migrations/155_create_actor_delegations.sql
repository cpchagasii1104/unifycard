-- ============================================================
-- UNIFICARD - MIGRATION 155
-- CONTINUOUS PRODUCTION: Actor Delegations
-- Tabela: actor_delegations
-- ============================================================
--
-- OBJETIVO:
-- Criar tabela de delegações entre actors.
-- Permite que um user (PF) atue em nome de um actor institucional.
--
-- REGRAS:
-- - Delegação NÃO é transitiva por padrão (is_transitive=false)
-- - Escopos explícitos (permissions)
-- - Expiração opcional
-- ============================================================

-- ============================================================
-- TABELA: actor_delegations
-- ============================================================
CREATE TABLE IF NOT EXISTS actor_delegations (
    -- Identificação
    delegation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- User (PF) que recebe a delegação
    user_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    
    -- Actor institucional que delega
    institutional_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    
    -- Escopos (permissions) - JSON array de strings
    scopes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Transitividade (default: false)
    is_transitive BOOLEAN NOT NULL DEFAULT false,
    
    -- Expiração opcional
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraint removida - será índice único parcial
    -- Nenhum constraint aqui, veja índice abaixo
    CONSTRAINT chk_delegation_status CHECK (status IN ('active', 'revoked', 'expired'))
);

-- Índice único parcial: apenas uma delegação ativa por par user+institutional
CREATE UNIQUE INDEX IF NOT EXISTS idx_actor_delegations_unique_active
    ON actor_delegations (tenant_id, user_actor_id, institutional_actor_id)
    WHERE status = 'active';

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para busca por user_actor
CREATE INDEX IF NOT EXISTS idx_actor_delegations_user
    ON actor_delegations (tenant_id, user_actor_id, status);

-- Índice para busca por institutional_actor
CREATE INDEX IF NOT EXISTS idx_actor_delegations_institutional
    ON actor_delegations (tenant_id, institutional_actor_id, status);

-- Índice para delegações ativas
CREATE INDEX IF NOT EXISTS idx_actor_delegations_active
    ON actor_delegations (tenant_id, status, expires_at)
    WHERE status = 'active';

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE actor_delegations ENABLE ROW LEVEL SECURITY;

CREATE POLICY actor_delegations_rls ON actor_delegations
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: Atualizar updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_actor_delegations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actor_delegations_updated_at
    BEFORE UPDATE ON actor_delegations
    FOR EACH ROW
    EXECUTE FUNCTION update_actor_delegations_updated_at();

-- ============================================================
-- TRIGGER: Marcar como expired quando expires_at passar
-- ============================================================
CREATE OR REPLACE FUNCTION check_delegation_expiration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expires_at IS NOT NULL AND NEW.expires_at < NOW() AND NEW.status = 'active' THEN
        NEW.status = 'expired';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actor_delegations_expiration
    BEFORE INSERT OR UPDATE ON actor_delegations
    FOR EACH ROW
    EXECUTE FUNCTION check_delegation_expiration();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE actor_delegations IS
    'Delegações entre actors. Permite que user (PF) atue em nome de actor institucional.';

COMMENT ON COLUMN actor_delegations.user_actor_id IS
    'Actor do tipo user (PF) que recebe a delegação';

COMMENT ON COLUMN actor_delegations.institutional_actor_id IS
    'Actor institucional (company, event, group, service, project) que delega';

COMMENT ON COLUMN actor_delegations.scopes_json IS
    'Escopos (permissions) em JSON array: ["publish_feed", "manage_financial", "create_events"]';

COMMENT ON COLUMN actor_delegations.is_transitive IS
    'Se true, delegação é transitiva (A->B permite B->C atuar por A). Default: false';

COMMENT ON COLUMN actor_delegations.expires_at IS
    'Data de expiração opcional. Após esta data, delegação não é mais válida.';







