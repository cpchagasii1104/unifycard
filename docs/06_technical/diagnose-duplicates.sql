-- ================================================
-- DIAGNÓSTICO DE DUPLICATAS DE CATEGORIAS
-- TAREFA B1: Identifica categorias duplicadas no banco
-- ================================================

-- 1. RAÍZES DUPLICADAS POR SLUG
-- Identifica grupos (parent_id IS NULL) com mesmo slug
SELECT 
    slug, 
    COUNT(*) as quantidade,
    STRING_AGG(category_id::text, ', ') as category_ids,
    STRING_AGG(name, ' | ') as nomes
FROM categories 
WHERE parent_id IS NULL 
GROUP BY slug 
HAVING COUNT(*) > 1
ORDER BY quantidade DESC, slug;

-- 2. RAÍZES DUPLICADAS POR NOME NORMALIZADO
-- Identifica grupos com nomes similares (case-insensitive, sem acentos)
SELECT 
    LOWER(TRIM(name)) as nome_normalizado,
    COUNT(*) as quantidade,
    STRING_AGG(category_id::text, ', ') as category_ids,
    STRING_AGG(name, ' | ') as nomes_originais,
    STRING_AGG(slug, ' | ') as slugs
FROM categories 
WHERE parent_id IS NULL 
GROUP BY LOWER(TRIM(name))
HAVING COUNT(*) > 1
ORDER BY quantidade DESC, nome_normalizado;

-- 3. SUBGRUPOS DUPLICADOS POR (parent_id, slug)
-- Identifica subgrupos com mesmo slug sob o mesmo parent
SELECT 
    parent_id,
    slug,
    COUNT(*) as quantidade,
    STRING_AGG(category_id::text, ', ') as category_ids,
    STRING_AGG(name, ' | ') as nomes
FROM categories 
WHERE parent_id IS NOT NULL 
GROUP BY parent_id, slug
HAVING COUNT(*) > 1
ORDER BY quantidade DESC, parent_id, slug;

-- 4. RESUMO GERAL
SELECT 
    'Raízes duplicadas (por slug)' as tipo,
    COUNT(*) as total_duplicatas
FROM (
    SELECT slug 
    FROM categories 
    WHERE parent_id IS NULL 
    GROUP BY slug 
    HAVING COUNT(*) > 1
) as dup_raizes_slug

UNION ALL

SELECT 
    'Raízes duplicadas (por nome)' as tipo,
    COUNT(*) as total_duplicatas
FROM (
    SELECT LOWER(TRIM(name))
    FROM categories 
    WHERE parent_id IS NULL 
    GROUP BY LOWER(TRIM(name))
    HAVING COUNT(*) > 1
) as dup_raizes_nome

UNION ALL

SELECT 
    'Subgrupos duplicados (por parent+slug)' as tipo,
    COUNT(*) as total_duplicatas
FROM (
    SELECT parent_id, slug
    FROM categories 
    WHERE parent_id IS NOT NULL 
    GROUP BY parent_id, slug
    HAVING COUNT(*) > 1
) as dup_subgrupos;




























