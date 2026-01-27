-- ============================================================
-- UNIFICARD - MIGRATION 173
-- SPRINT 38.1: MARKETPLACE EXECUÇÃO - Order Core
-- Tabela: order_items
-- ============================================================
--
-- OBJETIVO:
-- Criar estrutura canônica de itens de pedido.
-- Item sempre aponta para uma variante e quantidade.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Item sempre aponta para uma variante
-- - Quantidade não executa nada (não baixa estoque)
-- - Unidade deve ser compatível com a variante (validação leve)
-- - Nenhuma integração com estoque ou pagamento
-- ============================================================

-- ============================================================
-- TABELA: order_items
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Pedido ao qual o item pertence
    order_id UUID NOT NULL
        REFERENCES orders(id) ON DELETE CASCADE,
    
    -- Variante de produto
    product_variant_id UUID NOT NULL
        REFERENCES product_variants(id) ON DELETE RESTRICT,
    
    -- Quantidade (numeric para suportar decimais em pesáveis)
    quantity NUMERIC(20, 4) NOT NULL
        CHECK (quantity > 0),
    
    -- Unidade (ex: un, kg, g, l)
    unit VARCHAR(50) NOT NULL DEFAULT 'un',
    
    -- Metadados adicionais (JSONB)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por pedido
CREATE INDEX IF NOT EXISTS idx_order_items_order
    ON order_items (order_id);

-- Índice para buscar por variante
CREATE INDEX IF NOT EXISTS idx_order_items_variant
    ON order_items (product_variant_id);

-- Índice composto para listagem
CREATE INDEX IF NOT EXISTS idx_order_items_order_created
    ON order_items (order_id, created_at);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- RLS será herdado do pedido (via tenant_id do order)
-- Não precisamos criar policy aqui, mas habilitamos RLS
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Policy baseada no tenant do pedido
CREATE POLICY order_items_rls ON order_items
    USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
              AND orders.tenant_id::text = current_setting('app.current_tenant', true)
        )
    );

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE order_items IS
    'Itens de pedido. Sempre apontam para uma variante e quantidade. Não executam baixa de estoque ou cálculo de preço.';

COMMENT ON COLUMN order_items.product_variant_id IS
    'Variante de produto solicitada.';

COMMENT ON COLUMN order_items.quantity IS
    'Quantidade solicitada. Não executa baixa de estoque.';

COMMENT ON COLUMN order_items.unit IS
    'Unidade da quantidade (ex: un, kg, g, l). Deve ser compatível com a variante (validação leve).';

COMMENT ON COLUMN order_items.metadata IS
    'Metadados adicionais do item (JSONB). Puramente declarativo.';







