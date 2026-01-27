-- ============================================================
-- UNIFICARD - MIGRATION 183
-- SPRINT 48: PRICING, PROMOÇÕES E COMISSÕES (DECLARATIVO)
-- Tabela: product_prices
-- ============================================================
--
-- OBJETIVO:
-- Criar estrutura para preços base de produtos/variantes.
-- Preço é declarativo, resolvido ANTES do pedido.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - NÃO recalcular pagamento após criado
-- - NÃO alterar orders já criados
-- - Preço é resolvido ANTES do pedido
-- ============================================================

-- ============================================================
-- TABELA: product_prices
-- ============================================================
CREATE TABLE IF NOT EXISTS product_prices (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Variante do produto
    product_variant_id UUID NOT NULL
        REFERENCES product_variants(id) ON DELETE CASCADE,
    
    -- Preço
    price NUMERIC(20, 2) NOT NULL CHECK (price >= 0),
    
    -- Moeda
    currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
    
    -- Validade
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMP WITH TIME ZONE,
    
    -- Metadados adicionais (JSONB)
    -- Ex: source, reason, approved_by
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_product_prices_tenant
    ON product_prices (tenant_id);

-- Índice para buscar por variante
CREATE INDEX IF NOT EXISTS idx_product_prices_variant
    ON product_prices (tenant_id, product_variant_id);

-- Índice para buscar preço válido por data
CREATE INDEX IF NOT EXISTS idx_product_prices_validity
    ON product_prices (tenant_id, product_variant_id, valid_from, valid_to);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE product_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_prices_rls ON product_prices
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE TRIGGER product_prices_updated_at
    BEFORE UPDATE ON product_prices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE product_prices IS
    'Preços base de produtos/variantes. Declarativo, resolvido ANTES do pedido.';

COMMENT ON COLUMN product_prices.price IS
    'Preço base. Sempre >= 0.';

COMMENT ON COLUMN product_prices.valid_from IS
    'Data de início da validade. Padrão: NOW().';

COMMENT ON COLUMN product_prices.valid_to IS
    'Data de fim da validade. NULL = sem expiração.';

COMMENT ON COLUMN product_prices.metadata IS
    'Metadados: source, reason, approved_by.';







