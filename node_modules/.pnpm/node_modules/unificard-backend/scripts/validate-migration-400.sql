-- Validações pós-migração FASE 1
-- Execute após a migração: psql -h <HOST> -U <USER> -d <DATABASE> -f backend/scripts/validate-migration-400.sql

\echo '========================================'
\echo 'VALIDAÇÕES PÓS-MIGRAÇÃO FASE 1'
\echo '========================================'
\echo ''

\echo '1) Total origem (catalog_categories):'
SELECT COUNT(*) as total_origem FROM catalog_categories;

\echo ''
\echo '2) Total migrado (categories com legacy_source):'
SELECT COUNT(*) as total_migrado 
FROM categories
WHERE metadata->>'legacy_source' = 'catalog_categories';

\echo ''
\echo '3) Raízes migradas (parent_id IS NULL):'
SELECT COUNT(*) as raizes_migradas
FROM categories
WHERE metadata->>'legacy_source' = 'catalog_categories'
AND parent_id IS NULL;

\echo ''
\echo '4) Subcategorias migradas (parent_id IS NOT NULL):'
SELECT COUNT(*) as subcategorias_migradas
FROM categories
WHERE metadata->>'legacy_source' = 'catalog_categories'
AND parent_id IS NOT NULL;

\echo ''
\echo '5) Slugs duplicados (DEVE SER ZERO):'
SELECT slug, country_code, COUNT(*) as duplicados
FROM categories
WHERE metadata->>'legacy_source' = 'catalog_categories'
GROUP BY slug, country_code
HAVING COUNT(*) > 1;

\echo ''
\echo '6) Hierarquia preservada (verificar parent_id):'
SELECT 
    COUNT(*) FILTER (WHERE c.parent_id IS NULL AND cc.parent_id IS NULL) as raizes_ok,
    COUNT(*) FILTER (WHERE c.parent_id IS NOT NULL AND cc.parent_id IS NOT NULL) as subcategorias_ok,
    COUNT(*) FILTER (WHERE c.parent_id IS NULL AND cc.parent_id IS NOT NULL) as erro_raiz_deveria_ser_sub,
    COUNT(*) FILTER (WHERE c.parent_id IS NOT NULL AND cc.parent_id IS NULL) as erro_sub_deveria_ser_raiz
FROM categories c
JOIN catalog_categories cc ON cc.id::text = c.metadata->>'legacy_id'
WHERE c.metadata->>'legacy_source' = 'catalog_categories';

\echo ''
\echo '7) Scope correto (DEVE SER professional):'
SELECT scope, COUNT(*) as total
FROM categories
WHERE metadata->>'legacy_source' = 'catalog_categories'
GROUP BY scope;

\echo ''
\echo '8) Metadata completo (DEVE SER 0):'
SELECT COUNT(*) as sem_metadata
FROM categories
WHERE metadata->>'legacy_source' = 'catalog_categories'
AND (
    metadata->>'legacy_id' IS NULL
    OR metadata->>'legacy_source' IS NULL
);

\echo ''
\echo '========================================'
\echo 'FIM DAS VALIDAÇÕES'
\echo '========================================'



