-- ============================================================
-- UNIFICARD - MIGRATION 166
-- SPRINT 37.2: MARKETPLACE CORE - Produto & Variante
-- Tabela: products
-- ============================================================
--
-- OBJETIVO:
-- Criar estrutura canônica de produtos.
-- Produto é conceitual (ex: "Maçã Gala") e não possui SKU, preço ou estoque.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Produto é DECLARATIVO (não executa regras)
-- - Produto é conceitual (não possui SKU, preço ou estoque)
-- - Variantes (product_variants) contêm SKU/PLU
-- - Nenhuma integração com venda/pedido/pagamento
-- ============================================================

-- ============================================================
-- TABELA: products
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Nome do produto
    name VARCHAR(255) NOT NULL,
    
    -- Descrição
    description TEXT,
    
    -- Categoria
    category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    
    -- Tipo de produto (enum)
    product_type product_type NOT NULL,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
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
CREATE INDEX IF NOT EXISTS idx_products_tenant
    ON products (tenant_id);

-- Índice para buscar por categoria
CREATE INDEX IF NOT EXISTS idx_products_category
    ON products (tenant_id, category_id);

-- Índice para buscar produtos ativos
CREATE INDEX IF NOT EXISTS idx_products_active
    ON products (tenant_id, is_active) WHERE is_active = true;

-- Índice para buscar por tipo
CREATE INDEX IF NOT EXISTS idx_products_type
    ON products (tenant_id, product_type);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_rls ON products
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_products_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE products IS
    'Produtos conceituais do marketplace. Não possuem SKU, preço ou estoque. Variantes (product_variants) contêm SKU/PLU.';

COMMENT ON COLUMN products.category_id IS
    'Categoria do produto (opcional).';

COMMENT ON COLUMN products.product_type IS
    'Tipo de produto: UNIT, WEIGHT, LOT. Define comportamento no estoque (futuro).';

COMMENT ON COLUMN products.metadata IS
    'Metadados adicionais do produto (JSONB). Puramente declarativo.';

COMMENT ON COLUMN products.is_active IS
    'Indica se o produto está ativo. Não bloqueia operações automaticamente.';







