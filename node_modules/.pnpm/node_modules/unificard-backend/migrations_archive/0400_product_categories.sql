-- ============================================================
-- UNIFICARD - MIGRATION 163
-- SPRINT 37.1: MARKETPLACE CORE - Catálogo Canônico
-- Tabela: catalog_categories
-- ============================================================
--
-- OBJETIVO:
-- Criar estrutura canônica de categorias de produtos.
-- Categorias são hierárquicas (árvore opcional) e puramente declarativas.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Categorias são DECLARATIVAS (não executam regras)
-- - Hierarquia é opcional (parent_id pode ser NULL)
-- - Nenhuma lógica automática de herança
-- - Nenhuma integração com venda/pedido/pagamento
-- ============================================================

-- ============================================================
-- TABELA: catalog_categories
-- ============================================================
CREATE TABLE IF NOT EXISTS catalog_categories (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Nome da categoria
    name VARCHAR(255) NOT NULL,
    
    -- Slug (URL-friendly)
    slug VARCHAR(255) NOT NULL,
    
    -- Hierarquia (opcional)
    parent_id UUID REFERENCES catalog_categories(id) ON DELETE SET NULL,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Metadados adicionais (JSONB)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_catalog_category_slug_per_tenant UNIQUE (tenant_id, slug)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_catalog_categories_tenant
    ON catalog_categories (tenant_id);

-- Índice para buscar por parent (hierarquia)
CREATE INDEX IF NOT EXISTS idx_catalog_categories_parent
    ON catalog_categories (tenant_id, parent_id);

-- Índice para buscar categorias ativas
CREATE INDEX IF NOT EXISTS idx_catalog_categories_active
    ON catalog_categories (tenant_id, is_active) WHERE is_active = true;

-- Índice para busca por slug
CREATE INDEX IF NOT EXISTS idx_catalog_categories_slug
    ON catalog_categories (tenant_id, slug);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE catalog_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY catalog_categories_rls ON catalog_categories
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_catalog_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER catalog_categories_updated_at
    BEFORE UPDATE ON catalog_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_catalog_categories_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE catalog_categories IS
    'Categorias de produtos do marketplace. Hierarquia opcional, puramente declarativa.';

COMMENT ON COLUMN catalog_categories.parent_id IS
    'ID da categoria pai (NULL para categorias raiz). Hierarquia é opcional e não executa regras automáticas.';

COMMENT ON COLUMN catalog_categories.metadata IS
    'Metadados adicionais da categoria (JSONB). Puramente declarativo.';

COMMENT ON COLUMN catalog_categories.is_active IS
    'Indica se a categoria está ativa. Não bloqueia operações automaticamente.';







