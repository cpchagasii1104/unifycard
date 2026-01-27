-- ============================================================
-- UNIFICARD - MIGRATION 133
-- SPRINT 1: FUNDAÇÃO DO UNIFY BANK
-- Tabela: bank_splits
-- ============================================================
--
-- OBJETIVO:
-- Criar estrutura para splits (distribuições).
-- NOTA: Lógica de splits será implementada no Sprint 2.
-- Esta migration apenas cria a estrutura de dados.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Splits são imutáveis após criação
-- - Cada split referencia uma transação
-- - Soma de percentages deve ser <= 100
-- - Splits definem como o valor é distribuído
--
-- ============================================================

-- ============================================================
-- TABELA: bank_splits
-- ============================================================
CREATE TABLE IF NOT EXISTS bank_splits (
    -- Identificação
    split_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Referência à transação
    transaction_id UUID NOT NULL
        REFERENCES bank_transactions(transaction_id) ON DELETE CASCADE,
    
    -- Destino do split
    target_account_id UUID NOT NULL
        REFERENCES bank_accounts(account_id) ON DELETE RESTRICT,
    
    -- Valores
    amount NUMERIC(20, 2) NOT NULL
        CHECK (amount > 0),
    percentage NUMERIC(5, 2)
        CHECK (percentage IS NULL OR (percentage >= 0 AND percentage <= 100)),
    
    -- Tipo de split
    split_type VARCHAR(50) NOT NULL
        CHECK (split_type IN (
            'fee',              -- Taxa
            'regional_fund',    -- Fundo regional
            'reserve',          -- Reserva
            'escrow',           -- Custódia
            'revenue_share',    -- Participação na receita
            'referral'          -- Comissão de indicação
        )),
    
    -- Metadados
    description TEXT,
    metadata JSONB,
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para busca por transação
CREATE INDEX IF NOT EXISTS idx_bank_splits_transaction
    ON bank_splits (transaction_id);

-- Índice para busca por conta destino
CREATE INDEX IF NOT EXISTS idx_bank_splits_target_account
    ON bank_splits (target_account_id);

-- Índice para busca por tenant
CREATE INDEX IF NOT EXISTS idx_bank_splits_tenant_created
    ON bank_splits (tenant_id, created_at DESC);

-- Índice para busca por tipo
CREATE INDEX IF NOT EXISTS idx_bank_splits_type
    ON bank_splits (split_type);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE bank_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_splits_rls ON bank_splits
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE bank_splits IS
    'Splits (distribuições) do Unify Bank. Lógica será implementada no Sprint 2.';

COMMENT ON COLUMN bank_splits.split_id IS
    'ID único do split';

COMMENT ON COLUMN bank_splits.transaction_id IS
    'Transação à qual este split pertence';

COMMENT ON COLUMN bank_splits.target_account_id IS
    'Conta que recebe este split';

COMMENT ON COLUMN bank_splits.amount IS
    'Valor absoluto do split';

COMMENT ON COLUMN bank_splits.percentage IS
    'Percentual do split (opcional, se amount for usado)';

COMMENT ON COLUMN bank_splits.split_type IS
    'Tipo do split';







