-- ============================================================
-- UNIFICARD - MIGRATION 164
-- SPRINT 37.1: MARKETPLACE CORE - Catálogo Canônico
-- Tabela: product_attributes
-- ============================================================
--
-- OBJETIVO:
-- Criar estrutura canônica de atributos de produtos.
-- Atributos são DECLARATIVOS e não executam regras.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Atributos são DECLARATIVOS (não executam regras)
-- - Podem ser aplicados a categorias específicas (opcional)
-- - Nenhuma validação automática
-- - Nenhuma integração com venda/pedido/pagamento
-- ============================================================

-- ============================================================
-- ENUM: Tipo de dado do atributo
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_attribute_data_type') THEN
        CREATE TYPE product_attribute_data_type AS ENUM (
            'string',
            'number',
            'boolean',
            'enum'
        );
    END IF;
END $$;

-- ============================================================
-- TABELA: product_attributes
-- ============================================================
CREATE TABLE IF NOT EXISTS product_attributes (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Nome do atributo
    name VARCHAR(255) NOT NULL,
    
    -- Slug (URL-friendly)
    slug VARCHAR(255) NOT NULL,
    
    -- Tipo de dado
    data_type product_attribute_data_type NOT NULL,
    
    -- Unidade (opcional: kg, g, l, un, etc)
    unit VARCHAR(50),
    
    -- Obrigatório?
    is_required BOOLEAN NOT NULL DEFAULT false,
    
    -- Aplica-se a categoria específica? (NULL = todas)
    applies_to_category_id UUID REFERENCES product_categories(id) ON DELETE CASCADE,
    
    -- Metadados adicionais (JSONB)
    -- Para enum: pode conter valores permitidos
    -- Ex: {"enum_values": ["small", "medium", "large"]}
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_attribute_slug_per_tenant UNIQUE (tenant_id, slug)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_product_attributes_tenant
    ON product_attributes (tenant_id);

-- Índice para buscar por categoria
CREATE INDEX IF NOT EXISTS idx_product_attributes_category
    ON product_attributes (tenant_id, applies_to_category_id);

-- Índice para busca por slug
CREATE INDEX IF NOT EXISTS idx_product_attributes_slug
    ON product_attributes (tenant_id, slug);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE product_attributes ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_attributes_rls ON product_attributes
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_product_attributes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_attributes_updated_at
    BEFORE UPDATE ON product_attributes
    FOR EACH ROW
    EXECUTE FUNCTION update_product_attributes_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE product_attributes IS
    'Atributos declarativos de produtos. Não executam regras, apenas descrevem características.';

COMMENT ON COLUMN product_attributes.data_type IS
    'Tipo de dado do atributo: string, number, boolean, enum.';

COMMENT ON COLUMN product_attributes.unit IS
    'Unidade de medida (opcional): kg, g, l, un, etc.';

COMMENT ON COLUMN product_attributes.applies_to_category_id IS
    'Categoria específica a que o atributo se aplica (NULL = todas as categorias).';

COMMENT ON COLUMN product_attributes.metadata IS
    'Metadados adicionais. Para enum, pode conter valores permitidos em enum_values.';

COMMENT ON COLUMN product_attributes.is_required IS
    'Indica se o atributo é obrigatório. Não bloqueia operações automaticamente (apenas declarativo).';







