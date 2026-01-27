-- ============================================================
-- UNIFICARD - MIGRATION 175
-- SPRINT 39.1: MARKETPLACE EXECUÇÃO - Payment Intent
-- Tabela: payment_intents
-- ============================================================
--
-- OBJETIVO:
-- Criar estrutura para intenções de pagamento.
-- PaymentIntent representa ligação entre Order e pagamento pretendido.
-- NÃO executa transação bancária ainda.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - PaymentIntent não executa nada sozinho
-- - Um order pode ter múltiplos payment intents (tentativas)
-- - Estados são declarativos
-- - Nenhuma integração com Bank ainda
-- ============================================================

-- ============================================================
-- ENUM: Status do payment intent
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_intent_status') THEN
        CREATE TYPE payment_intent_status AS ENUM (
            'CREATED',      -- Criado (aguardando autorização)
            'AUTHORIZED',   -- Autorizado (pronto para executar)
            'FAILED',       -- Falhou
            'CANCELLED'     -- Cancelado
        );
    END IF;
END $$;

-- ============================================================
-- TABELA: payment_intents
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_intents (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Pedido associado
    order_id UUID NOT NULL
        REFERENCES orders(id) ON DELETE CASCADE,
    
    -- Valor do pagamento (numeric para precisão)
    amount NUMERIC(20, 2) NOT NULL
        CHECK (amount > 0),
    
    -- Moeda
    currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
    
    -- Status do intent
    status payment_intent_status NOT NULL DEFAULT 'CREATED',
    
    -- Metadados adicionais (JSONB)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_payment_intents_tenant
    ON payment_intents (tenant_id);

-- Índice para buscar por pedido
CREATE INDEX IF NOT EXISTS idx_payment_intents_order
    ON payment_intents (tenant_id, order_id);

-- Índice para buscar por status
CREATE INDEX IF NOT EXISTS idx_payment_intents_status
    ON payment_intents (tenant_id, status);

-- Índice composto para listagem comum
CREATE INDEX IF NOT EXISTS idx_payment_intents_order_status_created
    ON payment_intents (tenant_id, order_id, status, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_intents_rls ON payment_intents
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_payment_intents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_intents_updated_at
    BEFORE UPDATE ON payment_intents
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_intents_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE payment_intents IS
    'Intenções de pagamento. Representam ligação entre Order e pagamento pretendido. NÃO executam transação bancária ainda.';

COMMENT ON COLUMN payment_intents.order_id IS
    'Pedido associado. Um order pode ter múltiplos payment intents (tentativas).';

COMMENT ON COLUMN payment_intents.amount IS
    'Valor do pagamento pretendido. Não executa transação bancária.';

COMMENT ON COLUMN payment_intents.status IS
    'Status do intent: CREATED (aguardando), AUTHORIZED (pronto), FAILED (falhou), CANCELLED (cancelado). Declarativo, não executa regras.';

COMMENT ON COLUMN payment_intents.metadata IS
    'Metadados adicionais do intent (JSONB). Puramente declarativo.';







