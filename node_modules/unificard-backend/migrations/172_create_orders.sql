-- ============================================================
-- UNIFICARD - MIGRATION 172
-- SPRINT 38.1: MARKETPLACE EXECUÇÃO - Order Core
-- Tabela: orders
-- ============================================================
--
-- OBJETIVO:
-- Criar estrutura canônica de pedidos (orders).
-- Order representa intenção estruturada, não execução.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Order é agregador (não calcula preço)
-- - Status é declarativo (não executa regras)
-- - Nenhuma integração com pagamento, estoque ou Bank
-- - Nenhuma automação de execução
-- ============================================================

-- ============================================================
-- ENUM: Status do pedido
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE order_status AS ENUM (
            'DRAFT',      -- Rascunho (pode editar itens)
            'SUBMITTED',  -- Enviado (não pode mais editar)
            'CANCELLED',  -- Cancelado
            'EXPIRED'     -- Expirado
        );
    END IF;
END $$;

-- ============================================================
-- TABELA: orders
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Comprador (actor)
    buyer_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE RESTRICT,
    
    -- Vendedor (actor)
    seller_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE RESTRICT,
    
    -- Status do pedido
    status order_status NOT NULL DEFAULT 'DRAFT',
    
    -- Quantidade total (informativo, calculado de items)
    total_quantity NUMERIC(20, 4) NOT NULL DEFAULT 0,
    
    -- Metadados adicionais (JSONB)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_orders_tenant
    ON orders (tenant_id);

-- Índice para buscar por comprador
CREATE INDEX IF NOT EXISTS idx_orders_buyer
    ON orders (tenant_id, buyer_actor_id);

-- Índice para buscar por vendedor
CREATE INDEX IF NOT EXISTS idx_orders_seller
    ON orders (tenant_id, seller_actor_id);

-- Índice para buscar por status
CREATE INDEX IF NOT EXISTS idx_orders_status
    ON orders (tenant_id, status);

-- Índice composto para listagem comum
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status_created
    ON orders (tenant_id, status, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_rls ON orders
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_orders_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE orders IS
    'Pedidos do marketplace. Representam intenção estruturada, não execução. Não calcula preço, não integra com pagamento/estoque/Bank.';

COMMENT ON COLUMN orders.buyer_actor_id IS
    'Actor comprador (referência a actors).';

COMMENT ON COLUMN orders.seller_actor_id IS
    'Actor vendedor (referência a actors).';

COMMENT ON COLUMN orders.status IS
    'Status do pedido: DRAFT (pode editar), SUBMITTED (enviado), CANCELLED (cancelado), EXPIRED (expirado). Declarativo, não executa regras.';

COMMENT ON COLUMN orders.total_quantity IS
    'Quantidade total (informativo, calculado de order_items). Não representa preço ou valor.';

COMMENT ON COLUMN orders.metadata IS
    'Metadados adicionais do pedido (JSONB). Puramente declarativo.';







