-- ============================================================
-- UNIFICARD - MIGRATION 178
-- SPRINT 40.2: MARKETPLACE EXECUÇÃO - Payout Real
-- Tabela: payout_transactions
-- ============================================================
--
-- OBJETIVO:
-- Criar estrutura para execuções de payout.
-- Cada split gera um payout transaction.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Cada split gera um payout
-- - Histórico nunca é sobrescrito
-- - Payout segue exatamente o split declarado
-- ============================================================

-- ============================================================
-- ENUM: Status do payout
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_transaction_status') THEN
        CREATE TYPE payout_transaction_status AS ENUM (
            'PENDING',   -- Aguardando execução
            'SUCCESS',   -- Sucesso
            'FAILED'     -- Falhou
        );
    END IF;
END $$;

-- ============================================================
-- TABELA: payout_transactions
-- ============================================================
CREATE TABLE IF NOT EXISTS payout_transactions (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Payment Intent associado
    payment_intent_id UUID NOT NULL
        REFERENCES payment_intents(id) ON DELETE CASCADE,
    
    -- Payment Split associado
    payment_split_id UUID NOT NULL
        REFERENCES payment_intent_splits(id) ON DELETE RESTRICT,
    
    -- Recipiente do payout (actor)
    recipient_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE RESTRICT,
    
    -- Transação bancária (nullable até sucesso)
    bank_transaction_id UUID,
    
    -- Valor do payout (numeric para precisão)
    amount NUMERIC(20, 2) NOT NULL
        CHECK (amount > 0),
    
    -- Moeda
    currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
    
    -- Status da execução
    status payout_transaction_status NOT NULL DEFAULT 'PENDING',
    
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
CREATE INDEX IF NOT EXISTS idx_payout_transactions_tenant
    ON payout_transactions (tenant_id);

-- Índice para buscar por payment intent
CREATE INDEX IF NOT EXISTS idx_payout_transactions_intent
    ON payout_transactions (tenant_id, payment_intent_id);

-- Índice para buscar por payment split
CREATE INDEX IF NOT EXISTS idx_payout_transactions_split
    ON payout_transactions (tenant_id, payment_split_id);

-- Índice para buscar por recipient
CREATE INDEX IF NOT EXISTS idx_payout_transactions_recipient
    ON payout_transactions (tenant_id, recipient_actor_id);

-- Índice para buscar por status
CREATE INDEX IF NOT EXISTS idx_payout_transactions_status
    ON payout_transactions (tenant_id, status);

-- Índice para buscar por bank transaction
CREATE INDEX IF NOT EXISTS idx_payout_transactions_bank_transaction
    ON payout_transactions (tenant_id, bank_transaction_id)
    WHERE bank_transaction_id IS NOT NULL;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE payout_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY payout_transactions_rls ON payout_transactions
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_payout_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payout_transactions_updated_at
    BEFORE UPDATE ON payout_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_payout_transactions_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE payout_transactions IS
    'Execuções de payout. Cada split gera um payout transaction.';

COMMENT ON COLUMN payout_transactions.payment_split_id IS
    'Payment Split associado. Payout segue exatamente o split declarado.';

COMMENT ON COLUMN payout_transactions.amount IS
    'Valor do payout. Deve ser exatamente igual ao amount do split.';

COMMENT ON COLUMN payout_transactions.status IS
    'Status da execução: PENDING (aguardando), SUCCESS (sucesso), FAILED (falhou).';

COMMENT ON COLUMN payout_transactions.error_code IS
    'Código de erro (opcional). Registrado quando status = FAILED.';







