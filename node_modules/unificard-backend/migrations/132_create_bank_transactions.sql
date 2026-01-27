-- ============================================================
-- UNIFICARD - MIGRATION 132
-- SPRINT 1: FUNDAÇÃO DO UNIFY BANK
-- Tabela: bank_transactions
-- ============================================================
--
-- OBJETIVO:
-- Criar tabela de transações do Unify Bank.
-- Transações são registros de movimentações entre contas.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Transações são imutáveis após criação
-- - Cada transação gera entradas no ledger (double-entry)
-- - Transações podem ser revertidas (criando nova transação reversa)
-- - Idempotência via event_id
--
-- ============================================================

-- ============================================================
-- TABELA: bank_transactions
-- ============================================================
CREATE TABLE IF NOT EXISTS bank_transactions (
    -- Identificação
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Idempotência
    event_id UUID NOT NULL UNIQUE,
    
    -- Contas envolvidas
    from_account_id UUID
        REFERENCES bank_accounts(account_id) ON DELETE RESTRICT,
    to_account_id UUID
        REFERENCES bank_accounts(account_id) ON DELETE RESTRICT,
    
    -- Valores
    amount NUMERIC(20, 2) NOT NULL
        CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL
        CHECK (currency IN ('BRL', 'USD', 'EUR', 'TEST')),
    
    -- Tipo de transação
    transaction_type VARCHAR(50) NOT NULL
        CHECK (transaction_type IN (
            'transfer',      -- Transferência entre contas
            'deposit',       -- Depósito
            'withdrawal',    -- Saque
            'reversal',      -- Reversão de transação anterior
            'fee',           -- Taxa
            'split',          -- Split (Sprint 2)
            'escrow',        -- Custódia
            'release'        -- Liberação de custódia
        )),
    
    -- Referência a transação original (para reversões)
    original_transaction_id UUID
        REFERENCES bank_transactions(transaction_id) ON DELETE SET NULL,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
    
    -- Metadados
    description TEXT,
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    settled_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para busca por event_id (idempotência)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_transactions_event_id
    ON bank_transactions (event_id);

-- Índice para busca por conta origem
CREATE INDEX IF NOT EXISTS idx_bank_transactions_from_account
    ON bank_transactions (from_account_id, created_at DESC);

-- Índice para busca por conta destino
CREATE INDEX IF NOT EXISTS idx_bank_transactions_to_account
    ON bank_transactions (to_account_id, created_at DESC);

-- Índice para busca por tenant
CREATE INDEX IF NOT EXISTS idx_bank_transactions_tenant_created
    ON bank_transactions (tenant_id, created_at DESC);

-- Índice para busca por tipo
CREATE INDEX IF NOT EXISTS idx_bank_transactions_type
    ON bank_transactions (transaction_type, created_at DESC);

-- Índice para reversões
CREATE INDEX IF NOT EXISTS idx_bank_transactions_original
    ON bank_transactions (original_transaction_id)
    WHERE original_transaction_id IS NOT NULL;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_transactions_rls ON bank_transactions
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE bank_transactions IS
    'Transações do Unify Bank. Imutáveis após criação.';

COMMENT ON COLUMN bank_transactions.transaction_id IS
    'ID único da transação';

COMMENT ON COLUMN bank_transactions.event_id IS
    'ID do evento que gerou esta transação (para idempotência)';

COMMENT ON COLUMN bank_transactions.from_account_id IS
    'Conta de origem (NULL para depósitos)';

COMMENT ON COLUMN bank_transactions.to_account_id IS
    'Conta de destino (NULL para saques)';

COMMENT ON COLUMN bank_transactions.amount IS
    'Valor da transação (sempre positivo)';

COMMENT ON COLUMN bank_transactions.transaction_type IS
    'Tipo da transação';

COMMENT ON COLUMN bank_transactions.original_transaction_id IS
    'ID da transação original (para reversões)';

COMMENT ON COLUMN bank_transactions.status IS
    'Status: pending, completed, failed, reversed';







