-- ============================================================
-- UNIFICARD - MIGRATION 130
-- SPRINT 1: FUNDAÇÃO DO UNIFY BANK
-- Tabela: bank_accounts
-- ============================================================
--
-- OBJETIVO:
-- Criar tabela de contas do Unify Bank.
-- Esta é a fundação do sistema financeiro.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Contas são imutáveis após criação (não há UPDATE de estrutura)
-- - Saldo é SEMPRE calculado do ledger (cached_balance é apenas cache)
-- - Uma conta pertence a um tenant
-- - Uma conta tem um owner (user, company, system)
-- - Uma conta tem uma moeda (BRL, USD, EUR, TEST)
--
-- ============================================================

-- ============================================================
-- TABELA: bank_accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS bank_accounts (
    -- Identificação
    account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Owner da conta
    owner_id UUID NOT NULL,
    owner_type VARCHAR(50) NOT NULL
        CHECK (owner_type IN ('user', 'company', 'system')),
    
    -- Moeda da conta
    currency VARCHAR(3) NOT NULL DEFAULT 'BRL'
        CHECK (currency IN ('BRL', 'USD', 'EUR', 'TEST')),
    
    -- Cache de saldo (NÃO é fonte da verdade)
    -- Saldo real é SEMPRE calculado do ledger
    cached_balance NUMERIC(20, 2) NOT NULL DEFAULT 0,
    
    -- Metadados
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bank_accounts_tenant_owner
    ON bank_accounts (tenant_id, owner_id, owner_type);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_tenant_currency
    ON bank_accounts (tenant_id, currency);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_owner_type
    ON bank_accounts (owner_type);

-- ============================================================
-- UNIQUE CONSTRAINT
-- ============================================================
-- Uma conta única por owner + currency + tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_accounts_unique_owner_currency
    ON bank_accounts (tenant_id, owner_id, owner_type, currency);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_accounts_rls ON bank_accounts
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE bank_accounts IS
    'Contas do Unify Bank. Saldo é sempre calculado do ledger (cached_balance é apenas cache).';

COMMENT ON COLUMN bank_accounts.account_id IS
    'ID único da conta';

COMMENT ON COLUMN bank_accounts.tenant_id IS
    'Tenant ao qual a conta pertence';

COMMENT ON COLUMN bank_accounts.owner_id IS
    'ID do dono da conta (user_id, company_id, ou system account identifier)';

COMMENT ON COLUMN bank_accounts.owner_type IS
    'Tipo do dono: user, company, ou system';

COMMENT ON COLUMN bank_accounts.currency IS
    'Moeda da conta: BRL, USD, EUR, ou TEST (teste)';

COMMENT ON COLUMN bank_accounts.cached_balance IS
    'Cache do saldo. NÃO é fonte da verdade. Saldo real é calculado do ledger.';

COMMENT ON COLUMN bank_accounts.metadata IS
    'Metadados adicionais da conta (JSONB)';







