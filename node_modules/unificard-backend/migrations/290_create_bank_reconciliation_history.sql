-- backend/migrations/290_create_bank_reconciliation_history.sql
-- READ-MODEL: Histórico de Conciliações Bancárias (append-only)
-- Status: READ-MODEL PURO (não CORE, não fonte de verdade, não decisório)

-- ============================================================
-- TABELA: bank_reconciliation_history
-- ============================================================
-- REGRAS ABSOLUTAS:
-- - Append-only (sem UPDATE/DELETE)
-- - externalBalance é INPUT MANUAL do administrador
-- - NÃO integra com banco externo
-- - NÃO aciona decisões automáticas
-- - Histórico é apenas para auditoria e visualização

CREATE TABLE IF NOT EXISTS bank_reconciliation_history (
    -- Identificação
    reconciliation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Dados de reconciliação
    internal_balance NUMERIC(20, 2) NOT NULL,
    external_balance NUMERIC(20, 2) NOT NULL,
    difference NUMERIC(20, 2) NOT NULL,
    
    -- Moeda
    currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
    
    -- Filtros aplicados (para rastreabilidade)
    filters_applied JSONB DEFAULT '{}'::jsonb,
    
    -- Metadados adicionais
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Auditoria
    performed_by_user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_currency_valid CHECK (currency IN ('BRL', 'USD', 'EUR', 'TEST'))
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_bank_reconciliation_history_tenant_id
    ON bank_reconciliation_history(tenant_id);

-- Índice para buscar por tenant e data (ordem cronológica)
CREATE INDEX IF NOT EXISTS idx_bank_reconciliation_history_tenant_created
    ON bank_reconciliation_history(tenant_id, created_at DESC);

-- Índice para buscar por tenant e moeda
CREATE INDEX IF NOT EXISTS idx_bank_reconciliation_history_tenant_currency
    ON bank_reconciliation_history(tenant_id, currency);

-- Índice para buscar por usuário que executou
CREATE INDEX IF NOT EXISTS idx_bank_reconciliation_history_performed_by
    ON bank_reconciliation_history(performed_by_user_id)
    WHERE performed_by_user_id IS NOT NULL;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE bank_reconciliation_history IS 
'Histórico de conciliações bancárias (append-only). externalBalance é INPUT MANUAL do administrador. NÃO integra com banco externo. NÃO aciona decisões automáticas.';

COMMENT ON COLUMN bank_reconciliation_history.internal_balance IS 
'Saldo interno total (calculado do ledger) no momento da reconciliação';

COMMENT ON COLUMN bank_reconciliation_history.external_balance IS 
'Saldo bancário externo (INPUT MANUAL - fornecido pelo administrador)';

COMMENT ON COLUMN bank_reconciliation_history.difference IS 
'Diferença entre saldo interno e externo (internal_balance - external_balance)';

COMMENT ON COLUMN bank_reconciliation_history.filters_applied IS 
'Filtros aplicados na consolidação (currency, ownerType, etc) para rastreabilidade';

COMMENT ON COLUMN bank_reconciliation_history.performed_by_user_id IS 
'ID do usuário que executou a reconciliação (auditoria)';


