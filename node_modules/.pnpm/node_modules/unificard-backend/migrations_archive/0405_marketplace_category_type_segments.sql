-- ============================================================
-- UNIFICARD - MIGRATION 280
-- Marketplace Category Type - Segments
-- Adiciona metadata.category_type = 'segment' para departments do marketplace
-- ============================================================

BEGIN;

-- ============================================================
-- ATUALIZAR: Adicionar category_type='segment' aos departments
-- ============================================================
UPDATE categories
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{category_type}',
  '"segment"',
  true
)
WHERE metadata->>'domain' = 'marketplace'
  AND metadata->>'taxonomy' = 'department'
  AND parent_id IS NULL
  AND (metadata->>'category_type' IS NULL OR metadata->>'category_type' = '');

-- ============================================================
-- LOG: Verificar atualizações
-- ============================================================
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM categories
  WHERE metadata->>'domain' = 'marketplace'
    AND metadata->>'taxonomy' = 'department'
    AND parent_id IS NULL
    AND metadata->>'category_type' = 'segment';
  
  RAISE NOTICE 'Departments atualizados com category_type=segment: %', updated_count;
END $$;

COMMIT;



