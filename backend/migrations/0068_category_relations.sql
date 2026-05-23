-- ============================================================
-- 0068: category_relations (grafo semântico entre categorias)
-- ============================================================
-- Relações direcionadas entre nós da árvore canónica (SSOT).
-- Não altera `categories`; não popula dados.
-- FKs com ON DELETE CASCADE alinhado a outras tabelas multi-tenant.
-- ============================================================

BEGIN;

CREATE TABLE category_relations (
    relation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,

    from_category_id UUID NOT NULL REFERENCES categories (category_id) ON DELETE CASCADE,
    to_category_id UUID NOT NULL REFERENCES categories (category_id) ON DELETE CASCADE,

    relation_type TEXT NOT NULL CHECK (
        relation_type IN (
            'enables',
            'evolves_to',
            'related_to'
        )
    ),

    weight INTEGER DEFAULT 1,

    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE (tenant_id, from_category_id, to_category_id, relation_type)
);

CREATE INDEX idx_category_relations_from ON category_relations (from_category_id);
CREATE INDEX idx_category_relations_to ON category_relations (to_category_id);
CREATE INDEX idx_category_relations_type ON category_relations (relation_type);

COMMENT ON TABLE category_relations IS 'Relações semânticas entre categorias (grafo); árvore permanece em categories.';

COMMIT;
