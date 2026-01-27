-- ============================================================
-- UNIFICARD - MIGRATION 176
-- SPRINT 39.2: MARKETPLACE EXECUÇÃO - Payment Execution (Bank)
-- Tabela: payment_transactions
-- ============================================================
--
-- OBJETIVO:
-- Criar estrutura para execuções de pagamento.
-- Cada execução é registrada e vinculada a um Payment Intent.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Cada execution é registrada (não sobrescrever histórico)
-- - bank_transaction_id é nullable até sucesso
-- - Nenhuma lógica de split ainda
-- ============================================================

-- ============================================================
-- ENUM: Status da transação de pagamento
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_transaction_status') THEN
        CREATE TYPE payment_transaction_status AS ENUM (
            'PENDING',   -- Aguardando execução
            'SUCCESS',   -- Sucesso
            'FAILED'     -- Falhou
        );
    END IF;
END $$;

-- ============================================================
-- TABELA: payment_transactions
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_transactions (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Payment Intent associado
    payment_intent_id UUID NOT NULL
        REFERENCES payment_intents(id) ON DELETE CASCADE,
    
    -- Transação bancária (nullable até sucesso)
    bank_transaction_id UUID,
    
    -- Valor do pagamento (numeric para precisão)
    amount NUMERIC(20, 2) NOT NULL
        CHECK (amount > 0),
    
    -- Moeda
    currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
    
    -- Status da execução
    status payment_transaction_status NOT NULL DEFAULT 'PENDING',
    
    -- Código de erro (opcional)
    error_code VARCHAR(100),
    
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
CREATE INDEX IF NOT EXISTS idx_payment_transactions_tenant
    ON payment_transactions (tenant_id);

-- Índice para buscar por payment intent
CREATE INDEX IF NOT EXISTS idx_payment_transactions_intent
    ON payment_transactions (tenant_id, payment_intent_id);

-- Índice para buscar por status
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status
    ON payment_transactions (tenant_id, status);

-- Índice para buscar por bank transaction
CREATE INDEX IF NOT EXISTS idx_payment_transactions_bank_transaction
    ON payment_transactions (tenant_id, bank_transaction_id)
    WHERE bank_transaction_id IS NOT NULL;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_transactions_rls ON payment_transactions
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_payment_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_transactions_updated_at
    BEFORE UPDATE ON payment_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_transactions_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE payment_transactions IS
    'Execuções de pagamento. Cada execução é registrada e vinculada a um Payment Intent.';

COMMENT ON COLUMN payment_transactions.payment_intent_id IS
    'Payment Intent associado. Uma execução por intent.';

COMMENT ON COLUMN payment_transactions.bank_transaction_id IS
    'Transação bancária (nullable até sucesso). Referência à bank_transactions.';

COMMENT ON COLUMN payment_transactions.status IS
    'Status da execução: PENDING (aguardando), SUCCESS (sucesso), FAILED (falhou).';

COMMENT ON COLUMN payment_transactions.error_code IS
    'Código de erro (opcional). Registrado quando status = FAILED.';







