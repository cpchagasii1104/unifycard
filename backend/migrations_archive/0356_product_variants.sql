-- ============================================================
-- UNIFICARD - MIGRATION 167
-- SPRINT 37.2: MARKETPLACE CORE - Produto & Variante
-- Tabela: product_variants
-- ============================================================
--
-- OBJETIVO:
-- Criar estrutura canônica de variantes de produtos.
-- Variante representa forma física/comercial e contém SKU/PLU.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Variante é DECLARATIVA (não executa regras)
-- - Variante sempre pertence a um produto
-- - SKU/PLU vivem na variante (não no produto)
-- - attributes são valores concretos (ex: cor=vermelha)
-- - Nenhuma integração com venda/pedido/pagamento
-- ============================================================

-- ============================================================
-- TABELA: product_variants
-- ============================================================
CREATE TABLE IF NOT EXISTS product_variants (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Produto ao qual a variante pertence
    product_id UUID NOT NULL
        REFERENCES products(id) ON DELETE CASCADE,
    
    -- SKU (Stock Keeping Unit) - único por tenant
    sku VARCHAR(255) NOT NULL,
    
    -- PLU (Price Look-Up) - opcional, para pesáveis
    plu VARCHAR(255),
    
    -- Atributos (JSONB: chave → valor)
    -- Ex: {"cor": "vermelha", "tamanho": "M", "peso": "500g"}
    attributes JSONB DEFAULT '{}'::jsonb,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Metadados adicionais (JSONB)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_variant_sku_per_tenant UNIQUE (tenant_id, sku)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_product_variants_tenant
    ON product_variants (tenant_id);

-- Índice para buscar por produto
CREATE INDEX IF NOT EXISTS idx_product_variants_product
    ON product_variants (tenant_id, product_id);

-- Índice para buscar variantes ativas
CREATE INDEX IF NOT EXISTS idx_product_variants_active
    ON product_variants (tenant_id, is_active) WHERE is_active = true;

-- Índice para busca por SKU
CREATE INDEX IF NOT EXISTS idx_product_variants_sku
    ON product_variants (tenant_id, sku);

-- Índice para busca por PLU (quando presente)
CREATE INDEX IF NOT EXISTS idx_product_variants_plu
    ON product_variants (tenant_id, plu) WHERE plu IS NOT NULL;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_variants_rls ON product_variants
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_product_variants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_variants_updated_at
    BEFORE UPDATE ON product_variants
    FOR EACH ROW
    EXECUTE FUNCTION update_product_variants_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE product_variants IS
    'Variantes de produtos. Representam forma física/comercial e contêm SKU/PLU.';

COMMENT ON COLUMN product_variants.product_id IS
    'Produto ao qual a variante pertence. Variante sempre pertence a um produto.';

COMMENT ON COLUMN product_variants.sku IS
    'SKU (Stock Keeping Unit) - único por tenant. Identificador único da variante.';

COMMENT ON COLUMN product_variants.plu IS
    'PLU (Price Look-Up) - opcional, para produtos pesáveis (WEIGHT).';

COMMENT ON COLUMN product_variants.attributes IS
    'Atributos da variante (JSONB: chave → valor). Valores concretos (ex: cor=vermelha).';

COMMENT ON COLUMN product_variants.metadata IS
    'Metadados adicionais da variante (JSONB). Puramente declarativo.';

COMMENT ON COLUMN product_variants.is_active IS
    'Indica se a variante está ativa. Não bloqueia operações automaticamente.';







