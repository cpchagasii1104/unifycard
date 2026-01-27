-- ============================================================
-- UNIFICARD - MIGRATION 400
-- FASE 1: BACKFILL DE CATEGORIAS LEGADAS
-- Origem: catalog_categories
-- Destino: categories (core)
-- ============================================================
--
-- OBJETIVO:
-- Migrar dados de catalog_categories para categories (core)
-- preservando hierarquia, normalizando slugs, preservando rastreabilidade
--
-- REGRAS:
-- 1. Cada categoria legada vira UM nó em categories
-- 2. Hierarquia preservada via parent_id
-- 3. Slugs duplicados normalizados com prefixo
-- 4. Contexto definido corretamente (scope='professional', context='marketplace')
-- 5. IDs legados preservados em metadata
--
-- STATUS: FASE 1 — BACKFILL DE DADOS
-- ============================================================

BEGIN;

-- Adicionar esta migration à tabela schema_migrations
INSERT INTO schema_migrations (filename, executed_at)
VALUES ('400_backfill_catalog_categories_to_core.sql', NOW())
ON CONFLICT (filename) DO NOTHING;

-- ============================================================
-- 1. ANÁLISE PRÉ-MIGRAÇÃO
-- ============================================================

-- Criar tabela temporária para análise
CREATE TEMP TABLE IF NOT EXISTS migration_analysis AS
SELECT 
    COUNT(*) as total_categories,
    COUNT(DISTINCT tenant_id) as tenants_afetados,
    COUNT(*) FILTER (WHERE parent_id IS NULL) as raizes,
    COUNT(*) FILTER (WHERE is_active = true) as ativas,
    COUNT(*) FILTER (WHERE is_active = false) as inativas
FROM catalog_categories;

-- Log da análise
DO $$
DECLARE
    v_total INTEGER;
    v_tenants INTEGER;
    v_raizes INTEGER;
BEGIN
    SELECT total_categories, tenants_afetados, raizes
    INTO v_total, v_tenants, v_raizes
    FROM migration_analysis;
    
    RAISE NOTICE 'Análise pré-migração: % categorias, % tenants, % raizes', 
        v_total, v_tenants, v_raizes;
END $$;

-- ============================================================
-- 2. TABELA DE MAPEAMENTO (para rastreabilidade)
-- ============================================================

CREATE TABLE IF NOT EXISTS catalog_categories_mapping (
    legacy_id UUID PRIMARY KEY,
    category_id UUID NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    legacy_slug VARCHAR(255) NOT NULL,
    normalized_slug VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT catalog_categories_mapping_unique_legacy UNIQUE (legacy_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_categories_mapping_category_id 
    ON catalog_categories_mapping(category_id);

CREATE INDEX IF NOT EXISTS idx_catalog_categories_mapping_tenant_id 
    ON catalog_categories_mapping(tenant_id);

-- ============================================================
-- 3. FUNÇÃO: Normalizar slug para evitar conflitos
-- ============================================================

CREATE OR REPLACE FUNCTION normalize_catalog_slug(
    p_slug VARCHAR(255),
    p_tenant_id UUID,
    p_country_code CHAR(2)
) RETURNS VARCHAR(255) AS $$
DECLARE
    v_normalized VARCHAR(255);
    v_counter INTEGER := 0;
BEGIN
    -- Prefixar com hash do tenant_id para garantir unicidade por país
    -- Usar primeiros 8 caracteres do hash MD5 do tenant_id
    v_normalized := LOWER(SUBSTRING(MD5(p_tenant_id::text) FROM 1 FOR 8)) || '-' || p_slug;
    
    -- Verificar se já existe (com mesmo country_code)
    WHILE EXISTS (
        SELECT 1 FROM categories 
        WHERE slug = v_normalized 
        AND country_code = p_country_code
    ) LOOP
        v_counter := v_counter + 1;
        v_normalized := LOWER(SUBSTRING(MD5(p_tenant_id::text) FROM 1 FOR 8)) || '-' || p_slug || '-' || v_counter::text;
    END LOOP;
    
    RETURN v_normalized;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. MIGRAÇÃO: Categorias raiz (parent_id IS NULL)
-- ============================================================

INSERT INTO categories (
    slug,
    name,
    description,
    parent_id,
    scope,
    country_code,
    status,
    is_active,
    keywords,
    metadata,
    created_at,
    updated_at
)
SELECT
    normalize_catalog_slug(cc.slug, cc.tenant_id, COALESCE(t.country_code, NULL)) as slug,
    cc.name,
    NULL as description,
    NULL as parent_id,
    'professional' as scope,
    COALESCE(t.country_code, NULL) as country_code,
    CASE 
        WHEN cc.is_active THEN 'active'::category_status
        ELSE 'inactive'::category_status
    END as status,
    cc.is_active,
    ARRAY[]::TEXT[] as keywords,
    jsonb_build_object(
        'legacy_source', 'catalog_categories',
        'legacy_id', cc.id::text,
        'legacy_tenant_id', cc.tenant_id::text,
        'legacy_slug', cc.slug,
        'marketplace_domain', COALESCE(cc.metadata->>'marketplace_domain', 'market'),
        'category_type', COALESCE(cc.metadata->>'category_type', 'category')
    ) || COALESCE(cc.metadata, '{}'::jsonb) as metadata,
    cc.created_at,
    cc.updated_at
FROM catalog_categories cc
LEFT JOIN tenants t ON t.tenant_id = cc.tenant_id
WHERE cc.parent_id IS NULL
AND NOT EXISTS (
    SELECT 1 FROM catalog_categories_mapping m
    WHERE m.legacy_id = cc.id
)
RETURNING category_id, metadata->>'legacy_id' as legacy_id;

-- Registrar mapeamento de categorias raiz
INSERT INTO catalog_categories_mapping (legacy_id, category_id, tenant_id, legacy_slug, normalized_slug)
SELECT
    (c.metadata->>'legacy_id')::UUID as legacy_id,
    c.category_id,
    (c.metadata->>'legacy_tenant_id')::UUID as tenant_id,
    c.metadata->>'legacy_slug' as legacy_slug,
    c.slug as normalized_slug
FROM categories c
WHERE c.metadata->>'legacy_source' = 'catalog_categories'
AND c.parent_id IS NULL
AND NOT EXISTS (
    SELECT 1 FROM catalog_categories_mapping m
    WHERE m.legacy_id = (c.metadata->>'legacy_id')::UUID
);

-- ============================================================
-- 5. MIGRAÇÃO: Subcategorias (em ordem topológica)
-- ============================================================

-- Função recursiva para migrar subcategorias nível por nível
DO $$
DECLARE
    v_level INTEGER := 1;
    v_count INTEGER;
    v_max_level INTEGER;
BEGIN
    -- Determinar profundidade máxima da hierarquia
    WITH RECURSIVE category_tree AS (
        SELECT id, parent_id, 0 as depth
        FROM catalog_categories
        WHERE parent_id IS NULL
        
        UNION ALL
        
        SELECT cc.id, cc.parent_id, ct.depth + 1
        FROM catalog_categories cc
        JOIN category_tree ct ON cc.parent_id = ct.id
    )
    SELECT MAX(depth) INTO v_max_level FROM category_tree;
    
    RAISE NOTICE 'Profundidade máxima da hierarquia: %', v_max_level;
    
    -- Migrar nível por nível
    WHILE v_level <= COALESCE(v_max_level, 0) LOOP
        INSERT INTO categories (
            slug,
            name,
            description,
            parent_id,
            scope,
            country_code,
            status,
            is_active,
            keywords,
            metadata,
            created_at,
            updated_at
        )
        SELECT
            normalize_catalog_slug(cc.slug, cc.tenant_id, COALESCE(t.country_code, NULL)) as slug,
            cc.name,
            NULL as description,
            m.category_id as parent_id,
            'professional' as scope,
            COALESCE(t.country_code, NULL) as country_code,
            CASE 
                WHEN cc.is_active THEN 'active'::category_status
                ELSE 'inactive'::category_status
            END as status,
            cc.is_active,
            ARRAY[]::TEXT[] as keywords,
            jsonb_build_object(
                'legacy_source', 'catalog_categories',
                'legacy_id', cc.id::text,
                'legacy_tenant_id', cc.tenant_id::text,
                'legacy_slug', cc.slug,
                'marketplace_domain', COALESCE(cc.metadata->>'marketplace_domain', 'market'),
                'category_type', COALESCE(cc.metadata->>'category_type', 'category')
            ) || COALESCE(cc.metadata, '{}'::jsonb) as metadata,
            cc.created_at,
            cc.updated_at
        FROM catalog_categories cc
        JOIN catalog_categories_mapping m ON m.legacy_id = cc.parent_id
        LEFT JOIN tenants t ON t.tenant_id = cc.tenant_id
        WHERE cc.parent_id IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM catalog_categories_mapping m2
            WHERE m2.legacy_id = cc.id
        )
        -- Filtrar apenas categorias do nível atual
        AND NOT EXISTS (
            SELECT 1 FROM catalog_categories cc2
            JOIN catalog_categories_mapping m2 ON m2.legacy_id = cc2.parent_id
            WHERE cc2.parent_id = cc.id
            AND NOT EXISTS (
                SELECT 1 FROM catalog_categories_mapping m3
                WHERE m3.legacy_id = cc2.id
            )
        );
        
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Nível %: % categorias migradas', v_level, v_count;
        
        -- Registrar mapeamento das subcategorias migradas
        INSERT INTO catalog_categories_mapping (legacy_id, category_id, tenant_id, legacy_slug, normalized_slug)
        SELECT
            (c.metadata->>'legacy_id')::UUID as legacy_id,
            c.category_id,
            (c.metadata->>'legacy_tenant_id')::UUID as tenant_id,
            c.metadata->>'legacy_slug' as legacy_slug,
            c.slug as normalized_slug
        FROM categories c
        WHERE c.metadata->>'legacy_source' = 'catalog_categories'
        AND c.parent_id IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM catalog_categories_mapping m
            WHERE m.legacy_id = (c.metadata->>'legacy_id')::UUID
        );
        
        v_level := v_level + 1;
        
        -- Segurança: evitar loop infinito
        IF v_level > 20 THEN
            RAISE EXCEPTION 'Profundidade máxima excedida (20 níveis)';
        END IF;
    END LOOP;
END $$;

-- ============================================================
-- 6. ADICIONAR CONTEXTOS (category_contexts)
-- ============================================================

-- Verificar se tabela category_contexts existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'category_contexts') THEN
        INSERT INTO category_contexts (category_id, context, metadata, created_at, updated_at)
        SELECT
            c.category_id,
            'marketplace' as context,
            jsonb_build_object(
                'legacy_source', 'catalog_categories',
                'marketplace_domain', COALESCE(c.metadata->>'marketplace_domain', 'market')
            ) as metadata,
            NOW() as created_at,
            NOW() as updated_at
        FROM categories c
        WHERE c.metadata->>'legacy_source' = 'catalog_categories'
        AND NOT EXISTS (
            SELECT 1 FROM category_contexts cc
            WHERE cc.category_id = c.category_id
            AND cc.context = 'marketplace'
        );
        
        RAISE NOTICE 'Contextos marketplace adicionados';
    ELSE
        RAISE NOTICE 'Tabela category_contexts não existe, pulando adição de contextos';
    END IF;
END $$;

-- ============================================================
-- 7. VALIDAÇÕES OBRIGATÓRIAS
-- ============================================================

DO $$
DECLARE
    v_origem_count INTEGER;
    v_migrado_count INTEGER;
    v_parent_null_count INTEGER;
    v_slug_duplicado_count INTEGER;
    v_context_count INTEGER;
    v_metadata_count INTEGER;
BEGIN
    -- 1. COUNT categorias origem == COUNT categorias migradas
    SELECT COUNT(*) INTO v_origem_count FROM catalog_categories;
    SELECT COUNT(*) INTO v_migrado_count FROM catalog_categories_mapping;
    
    IF v_origem_count != v_migrado_count THEN
        RAISE EXCEPTION 'VALIDAÇÃO FALHOU: Origem (%) != Migrado (%)', v_origem_count, v_migrado_count;
    END IF;
    
    RAISE NOTICE '✓ Validação 1: Origem (%) == Migrado (%)', v_origem_count, v_migrado_count;
    
    -- 2. Nenhum parent_id NULL indevido (subcategorias devem ter parent)
    SELECT COUNT(*) INTO v_parent_null_count
    FROM categories c
    WHERE c.metadata->>'legacy_source' = 'catalog_categories'
    AND c.parent_id IS NULL
    AND EXISTS (
        SELECT 1 FROM catalog_categories cc
        WHERE cc.id::text = c.metadata->>'legacy_id'
        AND cc.parent_id IS NOT NULL
    );
    
    IF v_parent_null_count > 0 THEN
        RAISE EXCEPTION 'VALIDAÇÃO FALHOU: % subcategorias com parent_id NULL indevido', v_parent_null_count;
    END IF;
    
    RAISE NOTICE '✓ Validação 2: Nenhum parent_id NULL indevido';
    
    -- 3. Nenhum slug duplicado (por country_code)
    SELECT COUNT(*) INTO v_slug_duplicado_count
    FROM (
        SELECT slug, country_code, COUNT(*) as cnt
        FROM categories
        WHERE metadata->>'legacy_source' = 'catalog_categories'
        GROUP BY slug, country_code
        HAVING COUNT(*) > 1
    ) dups;
    
    IF v_slug_duplicado_count > 0 THEN
        RAISE EXCEPTION 'VALIDAÇÃO FALHOU: % slugs duplicados por country_code', v_slug_duplicado_count;
    END IF;
    
    RAISE NOTICE '✓ Validação 3: Nenhum slug duplicado';
    
    -- 4. Context = 'professional' (scope)
    SELECT COUNT(*) INTO v_context_count
    FROM categories
    WHERE metadata->>'legacy_source' = 'catalog_categories'
    AND scope != 'professional';
    
    IF v_context_count > 0 THEN
        RAISE EXCEPTION 'VALIDAÇÃO FALHOU: % categorias com scope != professional', v_context_count;
    END IF;
    
    RAISE NOTICE '✓ Validação 4: Scope = professional';
    
    -- 5. Metadata presente em 100% dos registros
    SELECT COUNT(*) INTO v_metadata_count
    FROM categories
    WHERE metadata->>'legacy_source' = 'catalog_categories'
    AND (
        metadata->>'legacy_id' IS NULL
        OR metadata->>'legacy_source' IS NULL
    );
    
    IF v_metadata_count > 0 THEN
        RAISE EXCEPTION 'VALIDAÇÃO FALHOU: % categorias sem metadata completo', v_metadata_count;
    END IF;
    
    RAISE NOTICE '✓ Validação 5: Metadata presente em 100%% dos registros';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'TODAS AS VALIDAÇÕES PASSARAM';
    RAISE NOTICE 'Categorias migradas: %', v_migrado_count;
    RAISE NOTICE '========================================';
END $$;

-- ============================================================
-- 8. ESTATÍSTICAS FINAIS
-- ============================================================

DO $$
DECLARE
    v_total_migrado INTEGER;
    v_raizes_migradas INTEGER;
    v_subcategorias_migradas INTEGER;
    v_ativas_migradas INTEGER;
    v_inativas_migradas INTEGER;
BEGIN
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE parent_id IS NULL),
        COUNT(*) FILTER (WHERE parent_id IS NOT NULL),
        COUNT(*) FILTER (WHERE status = 'active'),
        COUNT(*) FILTER (WHERE status = 'inactive')
    INTO 
        v_total_migrado,
        v_raizes_migradas,
        v_subcategorias_migradas,
        v_ativas_migradas,
        v_inativas_migradas
    FROM categories
    WHERE metadata->>'legacy_source' = 'catalog_categories';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ESTATÍSTICAS FINAIS';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total migrado: %', v_total_migrado;
    RAISE NOTICE 'Raizes: %', v_raizes_migradas;
    RAISE NOTICE 'Subcategorias: %', v_subcategorias_migradas;
    RAISE NOTICE 'Ativas: %', v_ativas_migradas;
    RAISE NOTICE 'Inativas: %', v_inativas_migradas;
    RAISE NOTICE '========================================';
END $$;

-- ============================================================
-- 9. LIMPEZA
-- ============================================================

DROP TABLE IF EXISTS migration_analysis;

COMMIT;

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
-- 
-- PRÓXIMOS PASSOS:
-- 1. Validar funcionamento do sistema
-- 2. Verificar que buscas continuam funcionando
-- 3. Monitorar por período de observação (30 dias)
-- 4. Após validação, executar FASE 2 (remapear FKs) se necessário
-- 5. Após período de observação, executar FASE 3 (desligamento)
-- 
-- ============================================================

