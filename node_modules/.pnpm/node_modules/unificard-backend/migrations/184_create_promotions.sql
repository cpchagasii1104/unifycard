-- ============================================================
-- UNIFICARD - MIGRATION 184
-- SPRINT 48: PRICING, PROMOÇÕES E COMISSÕES (DECLARATIVO)
-- Tabela: promotions
-- ============================================================
--
-- OBJETIVO:
-- Criar estrutura para promoções aplicáveis a produtos/variantes.
-- Promoção é declarativa, aplicada ANTES do pedido.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - NÃO recalcular pagamento após criado
-- - NÃO alterar orders já criados
-- - Promoção é aplicada ANTES do pedido
-- ============================================================

-- ============================================================
-- ENUM: Tipo de promoção
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promotion_type') THEN
        CREATE TYPE promotion_type AS ENUM (
            'PERCENTAGE',  -- Desconto percentual (ex: 10%)
            'FIXED'        -- Desconto fixo (ex: R$ 5,00)
        );
    END IF;
END $$;

-- ============================================================
-- ENUM: Aplicação da promoção
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promotion_applies_to') THEN
        CREATE TYPE promotion_applies_to AS ENUM (
            'VARIANT',    -- Aplica a variante específica
            'CATEGORY',   -- Aplica a categoria
            'PRODUCT'     -- Aplica a produto
        );
    END IF;
END $$;

-- ============================================================
-- TABELA: promotions
-- ============================================================
CREATE TABLE IF NOT EXISTS promotions (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Nome da promoção
    name VARCHAR(255) NOT NULL,
    
    -- Tipo de promoção
    type promotion_type NOT NULL,
    
    -- Valor da promoção
    -- PERCENTAGE: 0.0 a 100.0 (ex: 10.0 = 10%)
    -- FIXED: valor fixo (ex: 5.00 = R$ 5,00)
    value NUMERIC(20, 2) NOT NULL CHECK (value >= 0),
    
    -- Aplicação
    applies_to promotion_applies_to NOT NULL,
    applies_id UUID NOT NULL, -- product_variant_id, category_id, product_id
    
    -- Validade
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMP WITH TIME ZONE,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Metadados adicionais (JSONB)
    -- Ex: description, min_quantity, max_uses_per_user
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_promotions_tenant
    ON promotions (tenant_id);

-- Índice para buscar por aplicação
CREATE INDEX IF NOT EXISTS idx_promotions_applies
    ON promotions (tenant_id, applies_to, applies_id);

-- Índice para buscar promoções ativas
CREATE INDEX IF NOT EXISTS idx_promotions_validity
    ON promotions (tenant_id, is_active, valid_from, valid_to)
    WHERE is_active = true;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY promotions_rls ON promotions
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE TRIGGER promotions_updated_at
    BEFORE UPDATE ON promotions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE promotions IS
    'Promoções aplicáveis a produtos/variantes. Declarativa, aplicada ANTES do pedido.';

COMMENT ON COLUMN promotions.type IS
    'Tipo: PERCENTAGE (desconto percentual), FIXED (desconto fixo).';

COMMENT ON COLUMN promotions.value IS
    'Valor: PERCENTAGE (0-100), FIXED (valor fixo).';

COMMENT ON COLUMN promotions.applies_to IS
    'Aplicação: VARIANT (variante), CATEGORY (categoria), PRODUCT (produto).';

COMMENT ON COLUMN promotions.applies_id IS
    'ID da aplicação: product_variant_id, category_id, product_id.';

COMMENT ON COLUMN promotions.metadata IS
    'Metadados: description, min_quantity, max_uses_per_user.';







