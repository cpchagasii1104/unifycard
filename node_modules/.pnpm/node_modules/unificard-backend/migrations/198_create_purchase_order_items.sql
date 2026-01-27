-- ============================================================
-- UNIFICARD - MIGRATION 198
-- SPRINT 69: SUPPLIERS + PURCHASE ORDERS
-- Tabela: purchase_order_items
-- ============================================================
--
-- OBJETIVO:
-- Criar itens de Ordem de Compra (Purchase Order Items) que:
-- - Representa produtos na ordem de compra
-- - Quantidade solicitada vs recebida
-- - Inventory entra apenas no RECEIVE
--
-- REGRAS:
-- - Append-only (quantidades recebidas são registradas, mas não editadas)
-- - Status declarativos
-- - Audit em todas as mudanças
-- ============================================================

-- ============================================================
-- TABELA: purchase_order_items
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_order_items (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Ordem de compra
    purchase_order_id UUID NOT NULL
        REFERENCES purchase_orders(id) ON DELETE CASCADE,
    
    -- Variante de produto
    product_variant_id UUID NOT NULL
        REFERENCES product_variants(id) ON DELETE CASCADE,
    
    -- Quantidades
    quantity_ordered NUMERIC(20, 4) NOT NULL, -- Quantidade solicitada
    quantity_received NUMERIC(20, 4) NOT NULL DEFAULT 0, -- Quantidade recebida (acumulada)
    
    -- Unidade
    unit VARCHAR(50) NOT NULL DEFAULT 'un',
    
    -- Preço unitário (opcional)
    unit_price_cents BIGINT, -- Preço em centavos
    currency VARCHAR(10) DEFAULT 'BRL',
    
    -- Total (calculado: quantity_ordered * unit_price_cents)
    total_price_cents BIGINT, -- Total em centavos
    
    -- Notas
    notes TEXT,
    
    -- Criação
    created_by_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    created_by_user_id UUID,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_quantity_ordered_positive CHECK (quantity_ordered > 0),
    CONSTRAINT check_quantity_received_non_negative CHECK (quantity_received >= 0),
    CONSTRAINT check_quantity_received_not_exceed_ordered CHECK (quantity_received <= quantity_ordered)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_tenant_id
    ON purchase_order_items(tenant_id);

-- Índice para buscar por ordem
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order
    ON purchase_order_items(tenant_id, purchase_order_id);

-- Índice para buscar por variante
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_variant
    ON purchase_order_items(tenant_id, product_variant_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem itens do próprio tenant
CREATE POLICY purchase_order_items_tenant_isolation
    ON purchase_order_items
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================
-- TRIGGERS
-- ============================================================
-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_purchase_order_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_purchase_order_items_updated_at
    BEFORE UPDATE ON purchase_order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_purchase_order_items_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE purchase_order_items IS 'Itens de Ordem de Compra. Append-only: quantidades recebidas são acumuladas, mas não editadas.';
COMMENT ON COLUMN purchase_order_items.quantity_ordered IS 'Quantidade solicitada ao fornecedor';
COMMENT ON COLUMN purchase_order_items.quantity_received IS 'Quantidade recebida (acumulada, não pode exceder quantity_ordered)';






