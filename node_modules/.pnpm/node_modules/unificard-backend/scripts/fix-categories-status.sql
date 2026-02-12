-- ============================================================
-- CORREÇÃO RÁPIDA: Ativar categorias pending
-- ============================================================

-- 1) Verificar quantas categorias estão pending
SELECT 
  COUNT(*) as pending_count
FROM categories
WHERE status = 'pending';

-- 2) Atualizar categorias pending para active
UPDATE categories
SET status = 'active'
WHERE status = 'pending';

-- 3) Verificar resultado
SELECT 
  COUNT(*) as now_active
FROM categories
WHERE status = 'active';

-- 4) Atualizar categorias sem status (NULL) para active (compatibilidade)
UPDATE categories
SET status = 'active'
WHERE status IS NULL;

-- 5) Resultado final
SELECT 
  status,
  COUNT(*) as total
FROM categories
GROUP BY status
ORDER BY status;













