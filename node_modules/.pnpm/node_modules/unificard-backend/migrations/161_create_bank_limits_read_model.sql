-- ============================================================
-- UNIFICARD - MIGRATION 161
-- SPRINT 36.1: BANK SAFETY LAYER - Read Model (Derivado)
-- Tabela: bank_limits_read_model
-- ============================================================
--
-- OBJETIVO:
-- Criar read model para performance (DERIVADO, não soberano).
-- Esta tabela é DERIVADA da tabela bank_limit_change_requests.
-- Fonte de verdade = bank_limit_change_requests.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Esta tabela é DERIVADA
-- - Fonte de verdade = bank_limit_change_requests
-- - Pode ser recalculada a qualquer momento
-- - Usada apenas para performance/otimização
-- ============================================================

-- ============================================================
-- TABELA: bank_limits_read_model
-- ============================================================
CREATE TABLE IF NOT EXISTS bank_limits_read_model (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Actor que possui o limite
    actor_id UUID NOT NULL,
    
    -- Tipo de limite
    limit_type VARCHAR(50) NOT NULL
        CHECK (limit_type IN ('pix_out', 'transfer_out', 'payment_out', 'daily_out', 'monthly_out')),
    
    -- Limite atual (último applied)
    current_limit_amount NUMERIC(20, 2) NOT NULL DEFAULT 0,
    
    -- Limite pendente (se houver)
    pending_limit_amount NUMERIC(20, 2),
    
    -- Data de efetivação do limite pendente
    pending_effective_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamp de atualização (para cache invalidation)
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraint: uma linha por actor + tipo de limite
    CONSTRAINT unique_actor_limit_type UNIQUE (tenant_id, actor_id, limit_type)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar limites por actor
CREATE INDEX IF NOT EXISTS idx_bank_limits_read_model_actor
    ON bank_limits_read_model (tenant_id, actor_id);

-- Índice para buscar limites pendentes que devem ser aplicados
CREATE INDEX IF NOT EXISTS idx_bank_limits_read_model_pending
    ON bank_limits_read_model (tenant_id, pending_effective_at)
    WHERE pending_limit_amount IS NOT NULL;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE bank_limits_read_model ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_limits_read_model_rls ON bank_limits_read_model
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: Atualizar updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_bank_limits_read_model_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bank_limits_read_model_updated_at
    BEFORE UPDATE ON bank_limits_read_model
    FOR EACH ROW
    EXECUTE FUNCTION update_bank_limits_read_model_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE bank_limits_read_model IS
    '⚠️ READ MODEL DERIVADO - Esta tabela é DERIVADA. Fonte de verdade = bank_limit_change_requests. Pode ser recalculada a qualquer momento. Usada apenas para performance.';

COMMENT ON COLUMN bank_limits_read_model.current_limit_amount IS
    'Limite atual (derivado do último pedido com status=applied)';

COMMENT ON COLUMN bank_limits_read_model.pending_limit_amount IS
    'Limite pendente (se houver pedido com status=pending)';

COMMENT ON COLUMN bank_limits_read_model.pending_effective_at IS
    'Data de efetivação do limite pendente';







