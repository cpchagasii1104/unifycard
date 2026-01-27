-- ============================================================
-- UNIFICARD - MIGRATION 189
-- SPRINT 54: FULFILLMENT, PICKING E SAÍDA DE ESTOQUE
-- Tabelas: fulfillment_orders, fulfillment_items
-- ============================================================
--
-- OBJETIVO:
-- Criar estrutura para fulfillment (separação, picking, saída).
-- Fulfillment controla a saída física de estoque após pagamento.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Fulfillment é append-only (status muda, mas histórico não)
-- - 1 fulfillment por order
-- - Status é declarativo (sem automação escondida)
-- - Estoque só é baixado quando SHIPPED
-- ============================================================

-- ============================================================
-- ENUM: Origem do fulfillment
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fulfillment_source') THEN
        CREATE TYPE fulfillment_source AS ENUM (
            'PDV',        -- Fulfillment do PDV físico
            'MARKETPLACE' -- Fulfillment do marketplace online
        );
    END IF;
END $$;

-- ============================================================
-- ENUM: Status do fulfillment
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fulfillment_status') THEN
        CREATE TYPE fulfillment_status AS ENUM (
            'PENDING',   -- Aguardando separação
            'PICKED',    -- Itens separados (picking completo)
            'SHIPPED',   -- Enviado (estoque baixado)
            'CANCELLED'  -- Cancelado
        );
    END IF;
END $$;

-- ============================================================
-- ENUM: Status do item de fulfillment
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fulfillment_item_status') THEN
        CREATE TYPE fulfillment_item_status AS ENUM (
            'PENDING',  -- Aguardando picking
            'PICKED'    -- Item separado
        );
    END IF;
END $$;

-- ============================================================
-- TABELA: fulfillment_orders
-- ============================================================
CREATE TABLE IF NOT EXISTS fulfillment_orders (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Pedido associado (1:1)
    order_id UUID NOT NULL
        REFERENCES orders(id) ON DELETE RESTRICT,
    
    -- Origem do fulfillment
    source fulfillment_source NOT NULL,
    
    -- Status do fulfillment
    status fulfillment_status NOT NULL DEFAULT 'PENDING',
    
    -- Usuário que fez o picking
    picked_by_user_id UUID,
    
    -- Data de envio
    shipped_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadados adicionais (JSONB)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraint: 1 fulfillment por order
    CONSTRAINT unique_fulfillment_per_order UNIQUE (tenant_id, order_id)
);

-- ============================================================
-- TABELA: fulfillment_items
-- ============================================================
CREATE TABLE IF NOT EXISTS fulfillment_items (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Fulfillment order associado
    fulfillment_order_id UUID NOT NULL
        REFERENCES fulfillment_orders(id) ON DELETE CASCADE,
    
    -- Variante do produto
    product_variant_id UUID NOT NULL
        REFERENCES product_variants(id) ON DELETE RESTRICT,
    
    -- Quantidade a separar
    quantity NUMERIC(20, 4) NOT NULL CHECK (quantity > 0),
    
    -- Lote (opcional, para produtos com rastreabilidade)
    inventory_lot_id UUID
        REFERENCES inventory_lots(id) ON DELETE SET NULL,
    
    -- Status do item
    status fulfillment_item_status NOT NULL DEFAULT 'PENDING',
    
    -- Metadados adicionais (JSONB)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamp imutável
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_fulfillment_orders_tenant
    ON fulfillment_orders (tenant_id);

-- Índice para buscar por order
CREATE INDEX IF NOT EXISTS idx_fulfillment_orders_order
    ON fulfillment_orders (tenant_id, order_id);

-- Índice para buscar por status
CREATE INDEX IF NOT EXISTS idx_fulfillment_orders_status
    ON fulfillment_orders (tenant_id, status);

-- Índice composto para listagem comum
CREATE INDEX IF NOT EXISTS idx_fulfillment_orders_status_created
    ON fulfillment_orders (tenant_id, status, created_at DESC);

-- Índice para buscar itens por fulfillment
CREATE INDEX IF NOT EXISTS idx_fulfillment_items_fulfillment
    ON fulfillment_items (tenant_id, fulfillment_order_id);

-- Índice para buscar itens por variante
CREATE INDEX IF NOT EXISTS idx_fulfillment_items_variant
    ON fulfillment_items (tenant_id, product_variant_id);

-- Índice para buscar itens pendentes
CREATE INDEX IF NOT EXISTS idx_fulfillment_items_pending
    ON fulfillment_items (tenant_id, fulfillment_order_id, status)
    WHERE status = 'PENDING';

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE fulfillment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE fulfillment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY fulfillment_orders_rls ON fulfillment_orders
    USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE POLICY fulfillment_items_rls ON fulfillment_items
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE TRIGGER fulfillment_orders_updated_at
    BEFORE UPDATE ON fulfillment_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TRIGGER: Prevenir DELETE (append-only)
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_fulfillment_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'fulfillment_orders e fulfillment_items são append-only. DELETE não permitido.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_fulfillment_orders_delete
    BEFORE DELETE ON fulfillment_orders
    FOR EACH ROW
    EXECUTE FUNCTION prevent_fulfillment_delete();

CREATE TRIGGER prevent_fulfillment_items_delete
    BEFORE DELETE ON fulfillment_items
    FOR EACH ROW
    EXECUTE FUNCTION prevent_fulfillment_delete();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE fulfillment_orders IS
    'Fulfillment orders (separação, picking, saída). Controla saída física de estoque após pagamento. Append-only.';

COMMENT ON COLUMN fulfillment_orders.order_id IS
    'Pedido associado. 1 fulfillment por order.';

COMMENT ON COLUMN fulfillment_orders.source IS
    'Origem: PDV (físico) ou MARKETPLACE (online).';

COMMENT ON COLUMN fulfillment_orders.status IS
    'Status: PENDING (aguardando), PICKED (separado), SHIPPED (enviado, estoque baixado), CANCELLED (cancelado).';

COMMENT ON COLUMN fulfillment_orders.picked_by_user_id IS
    'Usuário que fez o picking. Registrado quando status muda para PICKED.';

COMMENT ON COLUMN fulfillment_orders.shipped_at IS
    'Data de envio. Registrado quando status muda para SHIPPED e estoque é baixado.';

COMMENT ON TABLE fulfillment_items IS
    'Itens de fulfillment. Representa cada item a ser separado.';

COMMENT ON COLUMN fulfillment_items.inventory_lot_id IS
    'Lote (opcional). Usado para produtos com rastreabilidade por lote.';

COMMENT ON COLUMN fulfillment_items.status IS
    'Status: PENDING (aguardando picking), PICKED (separado).';







