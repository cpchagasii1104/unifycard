-- ============================================================
-- DIAGNÓSTICO: Estado das categorias no banco
-- ============================================================

-- 1) Contar categorias por status
SELECT 
  COALESCE(status, 'NULL') as status,
  COUNT(*) as total
FROM categories
GROUP BY status
ORDER BY status;

-- 2) Contar categorias visíveis (que /tree pode retornar)
SELECT 
  COUNT(*) AS visiveis
FROM categories
WHERE status IS NULL OR status IN ('active', 'auto_active');

-- 3) Detalhar categorias visíveis
SELECT 
  category_id,
  name,
  slug,
  status,
  parent_id,
  country_code,
  level
FROM categories
WHERE status IS NULL OR status IN ('active', 'auto_active')
ORDER BY level ASC, name ASC
LIMIT 20;

-- 4) Verificar categorias raiz (parent_id IS NULL)
SELECT 
  COUNT(*) as root_categories
FROM categories
WHERE parent_id IS NULL
  AND (status IS NULL OR status IN ('active', 'auto_active'));

-- 5) Verificar se coluna status existe
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'categories' 
  AND column_name = 'status';

-- 6) Resumo final
SELECT 
  'Total de categorias' as metric,
  COUNT(*)::text as value
FROM categories
UNION ALL
SELECT 
  'Categorias active',
  COUNT(*)::text
FROM categories
WHERE status = 'active'
UNION ALL
SELECT 
  'Categorias NULL (compatibilidade)',
  COUNT(*)::text
FROM categories
WHERE status IS NULL
UNION ALL
SELECT 
  'Categorias visíveis (active + NULL)',
  COUNT(*)::text
FROM categories
WHERE status IS NULL OR status = 'active'
UNION ALL
SELECT 
  'Categorias raiz visíveis',
  COUNT(*)::text
FROM categories
WHERE parent_id IS NULL
  AND (status IS NULL OR status = 'active');













