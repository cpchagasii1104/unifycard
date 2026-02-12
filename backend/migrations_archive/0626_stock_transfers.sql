-- ============================================================
-- UNIFICARD - MIGRATION 190
-- SPRINT 55: TRANSFERÊNCIA DE ESTOQUE ENTRE FILIAIS
-- Tabelas: stock_transfers, stock_transfer_items
-- ============================================================
--
-- OBJETIVO:
-- Criar estrutura para transferência de estoque entre unidades organizacionais.
-- Transferência é interna, sem venda, sem pagamento, sem fiscal.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Transferência é append-only (status muda, mas histórico não)
-- - NÃO usa Order, Payment ou Fiscal
-- - Inventory_movements são a única fonte da verdade
-- - Estoque sai no SHIP, entra no RECEIVE
-- ============================================================

-- ============================================================
-- ENUM: Status da transferência
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_transfer_status') THEN
        CREATE TYPE stock_transfer_status AS ENUM (
            'DRAFT',     -- Rascunho (pode adicionar itens)
            'SHIPPED',   -- Enviado (estoque saiu do from_actor)
            'RECEIVED',  -- Recebido (estoque entrou no to_actor)
            'CANCELLED'  -- Cancelado
        );
    END IF;
END $$;

-- ============================================================
-- ENUM: Status do item da transferência
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_transfer_item_status') THEN
        CREATE TYPE stock_transfer_item_status AS ENUM (
            'PENDING',  -- Aguardando envio
            'SHIPPED',  -- Enviado (movement OUT criado)
            'RECEIVED'  -- Recebido (movement IN criado)
        );
    END IF;
END $$;

-- ============================================================
-- TABELA: stock_transfers
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_transfers (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Unidade de origem (actor)
    from_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE RESTRICT,
    
    -- Unidade de destino (actor)
    to_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE RESTRICT,
    
    -- Status da transferência
    status stock_transfer_status NOT NULL DEFAULT 'DRAFT',
    
    -- Usuário que solicitou a transferência
    requested_by_user_id UUID,
    
    -- Data de envio
    shipped_at TIMESTAMP WITH TIME ZONE,
    
    -- Data de recebimento
    received_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadados adicionais (JSONB)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraint: origem e destino devem ser diferentes
    CONSTRAINT different_actors CHECK (from_actor_id != to_actor_id)
);

-- ============================================================
-- TABELA: stock_transfer_items
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_transfer_items (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Transferência associada
    stock_transfer_id UUID NOT NULL
        REFERENCES stock_transfers(id) ON DELETE CASCADE,
    
    -- Variante do produto
    product_variant_id UUID NOT NULL
        REFERENCES product_variants(id) ON DELETE RESTRICT,
    
    -- Quantidade a transferir
    quantity NUMERIC(20, 4) NOT NULL CHECK (quantity > 0),
    
    -- Lote (opcional, para produtos com rastreabilidade)
    inventory_lot_id UUID
        REFERENCES inventory_lots(id) ON DELETE SET NULL,
    
    -- Status do item
    status stock_transfer_item_status NOT NULL DEFAULT 'PENDING',
    
    -- Metadados adicionais (JSONB)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamp imutável
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_stock_transfers_tenant
    ON stock_transfers (tenant_id);

-- Índice para buscar por origem
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from_actor
    ON stock_transfers (tenant_id, from_actor_id);

-- Índice para buscar por destino
CREATE INDEX IF NOT EXISTS idx_stock_transfers_to_actor
    ON stock_transfers (tenant_id, to_actor_id);

-- Índice para buscar por status
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status
    ON stock_transfers (tenant_id, status);

-- Índice composto para listagem comum
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status_created
    ON stock_transfers (tenant_id, status, created_at DESC);

-- Índice para buscar itens por transferência
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_transfer
    ON stock_transfer_items (tenant_id, stock_transfer_id);

-- Índice para buscar itens por variante
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_variant
    ON stock_transfer_items (tenant_id, product_variant_id);

-- Índice para buscar itens pendentes
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_pending
    ON stock_transfer_items (tenant_id, stock_transfer_id, status)
    WHERE status = 'PENDING';

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_transfers_rls ON stock_transfers
    USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE POLICY stock_transfer_items_rls ON stock_transfer_items
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE TRIGGER stock_transfers_updated_at
    BEFORE UPDATE ON stock_transfers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TRIGGER: Prevenir DELETE (append-only)
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_stock_transfer_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'stock_transfers e stock_transfer_items são append-only. DELETE não permitido.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_stock_transfers_delete
    BEFORE DELETE ON stock_transfers
    FOR EACH ROW
    EXECUTE FUNCTION prevent_stock_transfer_delete();

CREATE TRIGGER prevent_stock_transfer_items_delete
    BEFORE DELETE ON stock_transfer_items
    FOR EACH ROW
    EXECUTE FUNCTION prevent_stock_transfer_delete();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE stock_transfers IS
    'Transferências de estoque entre unidades organizacionais. Interna, sem venda, sem pagamento, sem fiscal. Append-only.';

COMMENT ON COLUMN stock_transfers.from_actor_id IS
    'Unidade de origem (actor). Estoque sai desta unidade no SHIP.';

COMMENT ON COLUMN stock_transfers.to_actor_id IS
    'Unidade de destino (actor). Estoque entra nesta unidade no RECEIVE.';

COMMENT ON COLUMN stock_transfers.status IS
    'Status: DRAFT (rascunho), SHIPPED (enviado, estoque saiu), RECEIVED (recebido, estoque entrou), CANCELLED (cancelado).';

COMMENT ON COLUMN stock_transfers.shipped_at IS
    'Data de envio. Registrado quando status muda para SHIPPED e inventory_movements OUT são criados.';

COMMENT ON COLUMN stock_transfers.received_at IS
    'Data de recebimento. Registrado quando status muda para RECEIVED e inventory_movements IN são criados.';

COMMENT ON TABLE stock_transfer_items IS
    'Itens de transferência. Representa cada item a ser transferido.';

COMMENT ON COLUMN stock_transfer_items.inventory_lot_id IS
    'Lote (opcional). Usado para produtos com rastreabilidade por lote.';

COMMENT ON COLUMN stock_transfer_items.status IS
    'Status: PENDING (aguardando envio), SHIPPED (enviado, movement OUT criado), RECEIVED (recebido, movement IN criado).';







