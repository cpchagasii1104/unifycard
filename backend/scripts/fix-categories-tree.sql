-- ============================================================
-- CORREÇÃO: Garantir categorias válidas para /categories/tree
-- ============================================================

-- 1) Verificar categorias existentes
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
  COUNT(CASE WHEN status IS NULL THEN 1 END) as null_status,
  COUNT(CASE WHEN status NOT IN ('active', 'auto_active') OR status IS NULL THEN 1 END) as invalid
FROM categories;

-- 2) Atualizar categorias sem status para 'active' (compatibilidade)
UPDATE categories
SET status = 'active'
WHERE status IS NULL;

-- 3) Verificar se existem categorias raiz (parent_id IS NULL)
SELECT 
  category_id,
  name,
  status,
  country_code,
  level
FROM categories
WHERE parent_id IS NULL
  AND (status = 'active' OR status IS NULL)
ORDER BY name ASC
LIMIT 10;

-- 4) Se não houver categorias raiz, criar uma de teste
DO $$
DECLARE
  root_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO root_count
  FROM categories
  WHERE parent_id IS NULL
    AND (status = 'active' OR status IS NULL);
  
  IF root_count = 0 THEN
    -- Criar categoria raiz de teste
    INSERT INTO categories (name, slug, description, level, path, status)
    VALUES (
      'Categoria Raiz',
      'categoria-raiz',
      'Categoria raiz de teste',
      0,
      ARRAY['categoria-raiz'],
      'active'
    )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Categoria raiz de teste criada';
  ELSE
    RAISE NOTICE 'Existem % categorias raiz', root_count;
  END IF;
END $$;

-- 5) Verificar resultado final
SELECT 
  category_id,
  name,
  status,
  parent_id,
  level,
  country_code
FROM categories
WHERE status = 'active' OR status IS NULL
ORDER BY level ASC, name ASC
LIMIT 20;













