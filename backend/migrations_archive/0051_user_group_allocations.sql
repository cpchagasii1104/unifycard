-- ============================================================
-- UNIFICARD - MIGRATION 151
-- CONTINUOUS PRODUCTION: User Group Allocations
-- Tabela: user_group_allocations
-- ============================================================
--
-- OBJETIVO:
-- Criar tabela para alocação de grupos definida pelo usuário.
-- Usuários podem alocar até 3 grupos com percentuais livres.
-- Usado pelo Split Engine para distribuir lucros.
--
-- REGRAS:
-- - Máximo 3 grupos por usuário
-- - Soma de percentuais deve ser <= 100%
-- - Restante vai para Regional Fund
-- ============================================================

-- ============================================================
-- TABELA: user_group_allocations
-- ============================================================
CREATE TABLE IF NOT EXISTS user_group_allocations (
    -- Identificação
    allocation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Usuário que definiu a alocação
    user_id UUID NOT NULL
        REFERENCES users(user_id) ON DELETE CASCADE,
    
    -- Grupo alocado
    group_id UUID NOT NULL
        REFERENCES groups(group_id) ON DELETE CASCADE,
    
    -- Percentual alocado em basis points (0-10000 = 0-100%)
    percentage_bps INTEGER NOT NULL
        CHECK (percentage_bps >= 0 AND percentage_bps <= 10000),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraint: máximo 3 grupos por usuário
    CONSTRAINT unique_user_group UNIQUE (tenant_id, user_id, group_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para busca por usuário
CREATE INDEX IF NOT EXISTS idx_user_group_allocations_user
    ON user_group_allocations (tenant_id, user_id);

-- Índice para busca por grupo
CREATE INDEX IF NOT EXISTS idx_user_group_allocations_group
    ON user_group_allocations (tenant_id, group_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE user_group_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_group_allocations_rls ON user_group_allocations
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: Atualizar updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_user_group_allocations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_group_allocations_updated_at
    BEFORE UPDATE ON user_group_allocations
    FOR EACH ROW
    EXECUTE FUNCTION update_user_group_allocations_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE user_group_allocations IS
    'Alocação de grupos definida pelo usuário para distribuição de lucros';

COMMENT ON COLUMN user_group_allocations.allocation_id IS
    'ID único da alocação';

COMMENT ON COLUMN user_group_allocations.user_id IS
    'ID do usuário que definiu a alocação';

COMMENT ON COLUMN user_group_allocations.group_id IS
    'ID do grupo alocado';

COMMENT ON COLUMN user_group_allocations.percentage_bps IS
    'Percentual alocado em basis points (0-10000 = 0-100%). Soma de todos os grupos do usuário deve ser <= 100%';







