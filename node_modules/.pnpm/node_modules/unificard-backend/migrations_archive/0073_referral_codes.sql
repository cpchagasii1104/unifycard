-- ============================================================
-- UNIFICARD - MIGRATION 204
-- SPRINT 74: GROUPS, INDICAÇÕES E COMISSÕES
-- Tabela: referral_codes
-- ============================================================
--
-- OBJETIVO:
-- Criar sistema de códigos de indicação (referral codes)
-- para rastrear origem de vendas e calcular comissões.
--
-- REGRAS:
-- - Nenhuma execução de pagamentos
-- - Nenhum split automático
-- - Nenhum payout
-- - Apenas cálculo, snapshot e rastreabilidade
-- ============================================================

-- ============================================================
-- TABELA: referral_codes
-- ============================================================
CREATE TABLE IF NOT EXISTS referral_codes (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Código (único por tenant)
    code VARCHAR(50) NOT NULL,
    
    -- Dono do código
    owner_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    
    -- Grupo associado (opcional)
    group_id UUID
        REFERENCES groups(group_id) ON DELETE SET NULL,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Criação
    created_by_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    created_by_user_id UUID,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_code_not_empty CHECK (LENGTH(TRIM(code)) > 0),
    CONSTRAINT referral_codes_code_unique UNIQUE (tenant_id, code)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_referral_codes_tenant_id
    ON referral_codes(tenant_id);

-- Índice para buscar por código
CREATE INDEX IF NOT EXISTS idx_referral_codes_code
    ON referral_codes(tenant_id, code)
    WHERE is_active = true;

-- Índice para buscar por owner
CREATE INDEX IF NOT EXISTS idx_referral_codes_owner
    ON referral_codes(tenant_id, owner_actor_id, is_active);

-- Índice para buscar por grupo
CREATE INDEX IF NOT EXISTS idx_referral_codes_group
    ON referral_codes(tenant_id, group_id)
    WHERE group_id IS NOT NULL;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem códigos do próprio tenant
CREATE POLICY referral_codes_tenant_isolation
    ON referral_codes
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE referral_codes IS 'Códigos de indicação (referral codes). Rastreia origem de vendas.';
COMMENT ON COLUMN referral_codes.code IS 'Código único por tenant';
COMMENT ON COLUMN referral_codes.owner_actor_id IS 'Actor dono do código';
COMMENT ON COLUMN referral_codes.group_id IS 'Grupo associado (opcional)';






