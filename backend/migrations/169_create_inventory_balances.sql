-- ============================================================
-- UNIFICARD - MIGRATION 169
-- SPRINT 37.3: MARKETPLACE CORE - Estoque (Movimentação)
-- Tabela: inventory_balances (READ MODEL OPCIONAL)
-- ============================================================
--
-- OBJETIVO:
-- Criar read model opcional para saldos de estoque.
-- Esta tabela é DERIVADA de inventory_movements.
-- Se apagar, saldo pode ser recalculado.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Esta tabela é DERIVADA (não é fonte da verdade)
-- - Fonte da verdade = inventory_movements
-- - Saldo nunca é editado diretamente
-- - Se apagar o read model, saldo pode ser recalculado
-- ============================================================

-- ============================================================
-- TABELA: inventory_balances (READ MODEL)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_balances (
    -- Identificação
    product_variant_id UUID PRIMARY KEY
        REFERENCES product_variants(id) ON DELETE CASCADE,
    
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Saldo atual (DERIVADO de inventory_movements)
    current_quantity NUMERIC(20, 4) NOT NULL DEFAULT 0,
    
    -- Unidade
    unit VARCHAR(50) NOT NULL DEFAULT 'un',
    
    -- Timestamp de última atualização
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para busca por tenant
CREATE INDEX IF NOT EXISTS idx_inventory_balances_tenant
    ON inventory_balances (tenant_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE inventory_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_balances_rls ON inventory_balances
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE inventory_balances IS
    '⚠️ READ MODEL OPCIONAL: Saldos de estoque derivados de inventory_movements. Fonte da verdade = inventory_movements. Se apagar, saldo pode ser recalculado.';

COMMENT ON COLUMN inventory_balances.current_quantity IS
    'Saldo atual DERIVADO de inventory_movements. NUNCA editar diretamente.';

COMMENT ON COLUMN inventory_balances.updated_at IS
    'Timestamp de última atualização do saldo derivado.';







