-- ============================================================
-- VALIDAÇÃO: Verificar categorias para /categories/tree
-- ============================================================

-- 1) Verificar se existem categorias ativas
SELECT 
  COUNT(*) as total_categorias,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as categorias_active,
  COUNT(CASE WHEN status = 'auto_active' THEN 1 END) as categorias_auto_active,
  COUNT(CASE WHEN status IS NULL THEN 1 END) as categorias_sem_status,
  COUNT(CASE WHEN status NOT IN ('active', 'auto_active') OR status IS NULL THEN 1 END) as categorias_invalidas
FROM categories;

-- 2) Listar categorias que DEVEM aparecer no tree
SELECT 
  category_id,
  name,
  slug,
  status,
  country_code,
  parent_id,
  level
FROM categories
WHERE status = 'active' 
   OR status = 'auto_active'
   OR status IS NULL
ORDER BY level ASC, name ASC
LIMIT 20;

-- 3) Verificar se há categorias com status inválido
SELECT 
  category_id,
  name,
  status,
  country_code
FROM categories
WHERE status IS NOT NULL 
  AND status NOT IN ('active', 'auto_active', 'pending', 'rejected', 'archived')
LIMIT 10;

-- 4) Verificar categorias raiz (sem parent)
SELECT 
  category_id,
  name,
  status,
  country_code,
  level
FROM categories
WHERE parent_id IS NULL
  AND (status = 'active' OR status = 'auto_active' OR status IS NULL)
ORDER BY name ASC;

-- 5) Verificar se coluna status existe
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'categories' 
  AND column_name = 'status';













