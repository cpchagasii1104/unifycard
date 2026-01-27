-- ============================================================
-- UNIFICARD - AUDITORIA DE DUPLICIDADES EM CATEGORIAS
-- ============================================================
-- 
-- OBJETIVO:
-- Detectar duplicidades, conflitos silenciosos e inconsistências
-- que podem impedir seeds ou causar vazamento de contexto.
--
-- USO:
-- Execute cada query individualmente e analise os resultados.
-- Se encontrar duplicidades, consulte o playbook de remediação.
-- ============================================================

-- ============================================================
-- (1) DUPLICIDADE POR SLUG + COUNTRY_CODE
-- ============================================================
-- Detecta violações do constraint UNIQUE (slug, country_code)
-- Se retornar linhas, há duplicidade real que pode bloquear inserts.
-- ============================================================
SELECT 
    slug, 
    country_code, 
    COUNT(*) AS total_duplicados,
    ARRAY_AGG(category_id) AS ids_duplicados,
    ARRAY_AGG(scope) AS scopes_envolvidos
FROM categories
GROUP BY slug, country_code
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- ============================================================
-- (2) DUPLICIDADE SEMÂNTICA (MESMO NAME + PARENT + SCOPE)
-- ============================================================
-- Detecta categorias com mesmo nome, mesmo pai e mesmo scope.
-- Pode indicar seeds duplicados ou inserções acidentais.
-- ============================================================
SELECT 
    scope, 
    parent_id, 
    name, 
    COUNT(*) AS total_duplicados,
    ARRAY_AGG(category_id) AS ids_duplicados,
    ARRAY_AGG(country_code) AS countries_envolvidos
FROM categories
GROUP BY scope, parent_id, name
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- ============================================================
-- (3) CONFLITO SILENCIOSO: SLUG REPETIDO EM DIFERENTES SCOPES
-- ============================================================
-- Como o UNIQUE é (slug, country_code) e NÃO inclui scope,
-- um mesmo slug pode existir em scopes diferentes no mesmo país.
-- Isso pode causar confusão, mas NÃO bloqueia inserts.
-- Se quiser evitar, precisaria mudar constraint para incluir scope.
-- ============================================================
SELECT 
    c.slug, 
    c.country_code, 
    ARRAY_AGG(DISTINCT c.scope) AS scopes_distintos, 
    COUNT(*) AS total_registros
FROM categories c
GROUP BY c.slug, c.country_code
HAVING COUNT(DISTINCT c.scope) > 1
ORDER BY total_registros DESC;

-- ============================================================
-- (4) VOLUME MÍNIMO: LEARNING E PROFESSIONAL
-- ============================================================
-- Verifica se learning/professional têm volume mínimo esperado.
-- Se retornar 0 ou muito baixo, pode indicar:
-- - Seed não rodou
-- - Conflito de slug impediu inserts
-- - Categorias foram deletadas acidentalmente
-- ============================================================
SELECT 
    scope, 
    COUNT(*) AS total_categorias,
    COUNT(DISTINCT country_code) AS paises_distintos
FROM categories 
WHERE scope IN ('learning', 'professional')
GROUP BY scope
ORDER BY scope;

-- ============================================================
-- (5) RAÍZES POR SCOPE (CATEGORIAS DE NÍVEL 0)
-- ============================================================
-- Verifica quantas categorias raiz existem por scope.
-- Esperado: pelo menos algumas raízes para learning e professional.
-- ============================================================
SELECT 
    scope, 
    COUNT(*) AS total_raizes
FROM categories 
WHERE parent_id IS NULL 
  AND scope IN ('learning', 'professional')
GROUP BY scope
ORDER BY scope;

-- ============================================================
-- (6) PATH/LEVEL INCONSISTENTE
-- ============================================================
-- Detecta categorias onde o tamanho do array path não corresponde
-- ao level + 1 (path deveria ter level+1 elementos).
-- Inconsistência pode quebrar navegação na árvore.
-- ============================================================
SELECT 
    category_id, 
    slug, 
    scope, 
    level, 
    array_length(path, 1) AS path_length,
    path,
    CASE 
        WHEN array_length(path, 1) IS NULL THEN 'path NULL'
        WHEN array_length(path, 1) IS DISTINCT FROM (level + 1) THEN 'INCONSISTENTE'
        ELSE 'OK'
    END AS status
FROM categories
WHERE array_length(path, 1) IS DISTINCT FROM (level + 1)
   OR (path IS NULL AND level > 0)
ORDER BY scope, level;

-- ============================================================
-- (7) VAZAMENTO ESTRUTURAL: FILHOS APONTANDO PARA PAI DE OUTRO SCOPE
-- ============================================================
-- Detecta categorias que têm parent_id apontando para categoria
-- de scope diferente. Isso é VAZAMENTO DE CONTEXTO e deve ser corrigido.
-- Exemplo: categoria learning com parent professional (ERRADO).
-- ============================================================
SELECT 
    child.category_id AS child_id,
    child.slug AS child_slug, 
    child.scope AS child_scope,
    child.parent_id,
    parent.category_id AS parent_id_real,
    parent.slug AS parent_slug, 
    parent.scope AS parent_scope
FROM categories child
JOIN categories parent ON parent.category_id = child.parent_id
WHERE child.scope IN ('learning', 'professional')
  AND parent.scope <> child.scope
ORDER BY child.scope, child.level;

-- ============================================================
-- (8) CATEGORIAS ÓRFÃS (PARENT_ID APONTA PARA REGISTRO INEXISTENTE)
-- ============================================================
-- Detecta categorias com parent_id que não existe mais.
-- Pode indicar deleção acidental ou migração incompleta.
-- ============================================================
SELECT 
    c.category_id,
    c.slug,
    c.scope,
    c.parent_id,
    c.level
FROM categories c
WHERE c.parent_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM categories p 
      WHERE p.category_id = c.parent_id
  )
ORDER BY c.scope, c.level;

-- ============================================================
-- (9) RESUMO POR SCOPE (VISÃO GERAL)
-- ============================================================
-- Fornece visão geral da distribuição de categorias por scope.
-- ============================================================
SELECT 
    scope,
    COUNT(*) AS total,
    COUNT(DISTINCT country_code) AS paises,
    COUNT(*) FILTER (WHERE parent_id IS NULL) AS raizes,
    COUNT(*) FILTER (WHERE parent_id IS NOT NULL) AS filhos,
    MIN(level) AS nivel_minimo,
    MAX(level) AS nivel_maximo
FROM categories
WHERE scope IN ('learning', 'professional', 'health')
GROUP BY scope
ORDER BY scope;





