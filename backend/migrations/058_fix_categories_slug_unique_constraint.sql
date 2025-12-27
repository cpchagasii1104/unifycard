-- ================================================
-- 058_fix_categories_slug_unique_constraint.sql
-- CORREÇÃO CRÍTICA: Constraint UNIQUE deve ser (slug, parent_id)
-- ================================================

-- PASSO 1: Remover constraint antiga (se existir)
-- A constraint antiga é criada por: slug TEXT NOT NULL UNIQUE
-- Isso cria uma constraint chamada categories_slug_key

DO $$
BEGIN
  -- Tentar remover constraint antiga se existir
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'categories'::regclass 
    AND conname = 'categories_slug_key'
  ) THEN
    ALTER TABLE categories DROP CONSTRAINT categories_slug_key;
    RAISE NOTICE 'Constraint categories_slug_key removida';
  END IF;
END $$;

-- PASSO 2: Criar constraint correta: (slug, parent_id) UNIQUE
-- Usar índices parciais para lidar com NULL em parent_id

-- Para parent_id IS NULL (raízes)
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_parent_unique_null 
ON categories (slug) 
WHERE parent_id IS NULL;

-- Para parent_id IS NOT NULL (subcategorias)
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_parent_unique_not_null 
ON categories (slug, parent_id) 
WHERE parent_id IS NOT NULL;

-- PASSO 3: Comentário explicativo
COMMENT ON INDEX categories_slug_parent_unique_null IS 
'Garante unicidade de slug para categorias raiz (parent_id IS NULL)';

COMMENT ON INDEX categories_slug_parent_unique_not_null IS 
'Garante unicidade de slug por parent_id para subcategorias (parent_id IS NOT NULL)';

-- ================================================
-- VERIFICAÇÃO
-- ================================================
-- Execute manualmente para verificar:
-- SELECT conname, pg_get_constraintdef(oid) 
-- FROM pg_constraint 
-- WHERE conrelid = 'categories'::regclass AND contype = 'u';
--
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'categories' AND indexname LIKE '%slug%parent%';















