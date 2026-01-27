-- ============================================================
-- UNIFICARD - MIGRATION 131
-- SPRINT 1: FUNDAÇÃO DO UNIFY BANK
-- Tabela: bank_ledger
-- ============================================================
--
-- OBJETIVO:
-- Criar ledger imutável (append-only) do Unify Bank.
-- Esta é a FONTE ÚNICA DA VERDADE para saldos.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Ledger é IMUTÁVEL (append-only, sem UPDATE/DELETE)
-- - Saldo é SEMPRE calculado do ledger
-- - Cada entrada registra balance_before e balance_after
-- - Double-entry: cada transação tem pelo menos 2 entradas (debit + credit)
-- - Invariante: soma de credits - soma de debits = saldo da conta
--
-- ============================================================

-- ============================================================
-- TABELA: bank_ledger
-- ============================================================
CREATE TABLE IF NOT EXISTS bank_ledger (
    -- Identificação
    entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Referências
    account_id UUID NOT NULL
        REFERENCES bank_accounts(account_id) ON DELETE RESTRICT,
    transaction_id UUID NOT NULL,
    
    -- Tipo de entrada (double-entry)
    entry_type VARCHAR(10) NOT NULL
        CHECK (entry_type IN ('credit', 'debit')),
    
    -- Valores
    amount NUMERIC(20, 2) NOT NULL
        CHECK (amount > 0),
    
    -- Saldos antes e depois (para auditoria e validação)
    balance_before NUMERIC(20, 2) NOT NULL,
    balance_after NUMERIC(20, 2) NOT NULL,
    
    -- Metadados
    description TEXT,
    metadata JSONB,
    
    -- Timestamp imutável
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice principal para cálculo de saldo
CREATE INDEX IF NOT EXISTS idx_bank_ledger_account_created
    ON bank_ledger (account_id, created_at DESC);

-- Índice para busca por transação
CREATE INDEX IF NOT EXISTS idx_bank_ledger_transaction
    ON bank_ledger (transaction_id);

-- Índice para busca por tenant
CREATE INDEX IF NOT EXISTS idx_bank_ledger_tenant_created
    ON bank_ledger (tenant_id, created_at DESC);

-- Índice composto para queries de saldo
CREATE INDEX IF NOT EXISTS idx_bank_ledger_account_type_created
    ON bank_ledger (account_id, entry_type, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE bank_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_ledger_rls ON bank_ledger
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: Prevenir UPDATE/DELETE (Ledger é imutável)
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'bank_ledger is immutable (append-only). UPDATE and DELETE are forbidden.';
END;
$$ LANGUAGE plpgsql;

-- Trigger para prevenir UPDATE
CREATE TRIGGER prevent_bank_ledger_update
    BEFORE UPDATE ON bank_ledger
    FOR EACH ROW
    EXECUTE FUNCTION prevent_ledger_modification();

-- Trigger para prevenir DELETE
CREATE TRIGGER prevent_bank_ledger_delete
    BEFORE DELETE ON bank_ledger
    FOR EACH ROW
    EXECUTE FUNCTION prevent_ledger_modification();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE bank_ledger IS
    'Ledger imutável (append-only) do Unify Bank. Fonte única da verdade para saldos.';

COMMENT ON COLUMN bank_ledger.entry_id IS
    'ID único da entrada no ledger';

COMMENT ON COLUMN bank_ledger.account_id IS
    'Conta à qual esta entrada pertence';

COMMENT ON COLUMN bank_ledger.transaction_id IS
    'ID da transação que gerou esta entrada';

COMMENT ON COLUMN bank_ledger.entry_type IS
    'Tipo: credit (entrada) ou debit (saída)';

COMMENT ON COLUMN bank_ledger.amount IS
    'Valor da movimentação (sempre positivo)';

COMMENT ON COLUMN bank_ledger.balance_before IS
    'Saldo da conta ANTES desta entrada (para auditoria)';

COMMENT ON COLUMN bank_ledger.balance_after IS
    'Saldo da conta DEPOIS desta entrada (para validação)';

COMMENT ON COLUMN bank_ledger.created_at IS
    'Timestamp imutável da criação da entrada';







