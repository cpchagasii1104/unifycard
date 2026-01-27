-- ============================================================
-- UNIFICARD - MIGRATION 212
-- SPRINT 77: SETTLEMENT REGIONAL + UNIFYBANK CORE
-- Tabela: region_accounts
-- ============================================================
--
-- OBJETIVO:
-- Criar contas regionais para armazenar saldo de taxas liquidadas.
--
-- REGRAS:
-- - RegionAccount ≠ BankAccount
-- - Tudo explícito e auditável
-- - Nada automático sem ação explícita
-- ============================================================

-- ============================================================
-- TABELA: region_accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS region_accounts (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Região
    region_id UUID NOT NULL, -- Referência a rides_regions ou state_id
    
    -- Saldo
    balance_cents BIGINT NOT NULL DEFAULT 0, -- Saldo em centavos
    currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
    
    -- Criação
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_balance_not_negative CHECK (balance_cents >= 0),
    CONSTRAINT region_accounts_unique UNIQUE (tenant_id, region_id, currency)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_region_accounts_tenant_id
    ON region_accounts(tenant_id);

-- Índice para buscar por região
CREATE INDEX IF NOT EXISTS idx_region_accounts_region
    ON region_accounts(tenant_id, region_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE region_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem contas do próprio tenant
CREATE POLICY region_accounts_tenant_isolation
    ON region_accounts
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================
-- TRIGGERS
-- ============================================================
-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_region_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_region_accounts_updated_at
    BEFORE UPDATE ON region_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_region_accounts_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE region_accounts IS 'Contas regionais para saldo de taxas liquidadas. RegionAccount ≠ BankAccount.';
COMMENT ON COLUMN region_accounts.region_id IS 'Região (rides_regions.region_id ou state_id)';
COMMENT ON COLUMN region_accounts.balance_cents IS 'Saldo em centavos (não pode ser negativo)';






