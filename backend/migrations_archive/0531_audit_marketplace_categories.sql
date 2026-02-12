-- ============================================================
-- UNIFICARD - AUDIT SCRIPT
-- Marketplace Categories - Auditoria do Estado Atual
-- Script SOMENTE LEITURA para diagnosticar o estado do banco
-- ============================================================

-- Listar todas as categorias do marketplace com informações relevantes
SELECT 
  category_id as id,
  name,
  slug,
  parent_id,
  metadata->>'domain' as domain,
  metadata->>'taxonomy' as taxonomy,
  metadata->>'marketplace_domain' as marketplace_domain,
  metadata->>'category_type' as category_type,
  is_active,
  created_at,
  updated_at
FROM categories
WHERE metadata->>'domain' = 'marketplace'
ORDER BY parent_id NULLS FIRST, name ASC;

-- Contagem por tipo
SELECT 
  metadata->>'category_type' as category_type,
  metadata->>'marketplace_domain' as marketplace_domain,
  COUNT(*) as total
FROM categories
WHERE metadata->>'domain' = 'marketplace'
GROUP BY metadata->>'category_type', metadata->>'marketplace_domain'
ORDER BY category_type, marketplace_domain;

-- Contagem de segments por domínio
SELECT 
  metadata->>'marketplace_domain' as marketplace_domain,
  COUNT(*) as segments_count
FROM categories
WHERE metadata->>'domain' = 'marketplace'
  AND metadata->>'category_type' = 'segment'
  AND parent_id IS NULL
GROUP BY metadata->>'marketplace_domain'
ORDER BY marketplace_domain;



