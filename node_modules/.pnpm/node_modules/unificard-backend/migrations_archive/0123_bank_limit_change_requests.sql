-- ============================================================
-- UNIFICARD - MIGRATION 160
-- SPRINT 36.1: BANK SAFETY LAYER - Modelo Canônico de Limites
-- Tabela: bank_limit_change_requests
-- ============================================================
--
-- OBJETIVO:
-- Criar modelo institucional para pedidos de mudança de limite
-- com cooldown de 24h para aumento, respeitando princípios canônicos:
-- - decisões são eventos
-- - estado derivado não é soberano
-- - tabela é append-only (não deletar registros)
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Tabela é APPEND-ONLY (não deletar registros)
-- - Status muda, registro não some
-- - Limite atual é derivado (último applied por tipo)
-- - Aumentos têm cooldown de 24h (effective_at = now + 24h)
-- - Reduções são aplicadas imediatamente (effective_at = now)
-- ============================================================

-- ============================================================
-- TABELA: bank_limit_change_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS bank_limit_change_requests (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Actor/User que possui o limite
    -- Usa mesmo identificador usado para wallet (owner_id)
    -- Para users: global_user_id
    -- Para companies: company_id
    actor_id UUID NOT NULL,
    
    -- Tipo de limite
    limit_type VARCHAR(50) NOT NULL
        CHECK (limit_type IN ('pix_out', 'transfer_out', 'payment_out', 'daily_out', 'monthly_out')),
    
    -- Valor solicitado (em centavos ou unidade mínima)
    requested_amount NUMERIC(20, 2) NOT NULL
        CHECK (requested_amount >= 0),
    
    -- Timestamp da solicitação
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Timestamp de efetivação
    -- Para aumentos: now + 24h (cooldown)
    -- Para reduções: now (imediato)
    effective_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Status do pedido
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'applied', 'cancelled')),
    
    -- Quem solicitou (pode ser diferente do actor_id em caso de delegação)
    requested_by_user_id UUID,
    
    -- Fonte de autoridade
    authority_source VARCHAR(20) NOT NULL DEFAULT 'self'
        CHECK (authority_source IN ('self', 'delegated', 'system')),
    
    -- Metadados adicionais (JSONB)
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar limites atuais por actor e tipo
CREATE INDEX IF NOT EXISTS idx_bank_limit_requests_actor_type_status
    ON bank_limit_change_requests (tenant_id, actor_id, limit_type, status, effective_at DESC);

-- Índice para buscar pedidos pendentes que devem ser aplicados
CREATE INDEX IF NOT EXISTS idx_bank_limit_requests_pending_effective
    ON bank_limit_change_requests (tenant_id, status, effective_at)
    WHERE status = 'pending';

-- Índice para auditoria (buscar histórico por actor)
CREATE INDEX IF NOT EXISTS idx_bank_limit_requests_actor_created
    ON bank_limit_change_requests (tenant_id, actor_id, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE bank_limit_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_limit_change_requests_rls ON bank_limit_change_requests
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: Atualizar updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_bank_limit_change_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bank_limit_change_requests_updated_at
    BEFORE UPDATE ON bank_limit_change_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_bank_limit_change_requests_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE bank_limit_change_requests IS
    'Pedidos de mudança de limite bancário (APPEND-ONLY). Estado derivado não é soberano.';

COMMENT ON COLUMN bank_limit_change_requests.id IS
    'ID único do pedido';

COMMENT ON COLUMN bank_limit_change_requests.actor_id IS
    'ID do actor que possui o limite (mesmo identificador usado para wallet: global_user_id para users, company_id para companies)';

COMMENT ON COLUMN bank_limit_change_requests.limit_type IS
    'Tipo de limite: pix_out, transfer_out, payment_out, daily_out, monthly_out';

COMMENT ON COLUMN bank_limit_change_requests.requested_amount IS
    'Valor solicitado (em centavos ou unidade mínima)';

COMMENT ON COLUMN bank_limit_change_requests.effective_at IS
    'Timestamp de efetivação: aumentos têm cooldown de 24h, reduções são imediatas';

COMMENT ON COLUMN bank_limit_change_requests.status IS
    'Status: pending (aguardando efetivação), applied (aplicado), cancelled (cancelado)';

COMMENT ON COLUMN bank_limit_change_requests.authority_source IS
    'Fonte de autoridade: self (próprio usuário), delegated (delegado), system (sistema)';

COMMENT ON COLUMN bank_limit_change_requests.metadata IS
    'Metadados adicionais (JSONB)';







