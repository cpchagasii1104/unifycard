-- ============================================================
-- 0099: N1 beleza-estetica (taxonomia v2.1)
-- ============================================================
-- Lacuna: salão, manicure, cabeleireiro, barbeiro, maquiagem,
-- estética facial/corporal — alinhado a docs/01_normative/taxonomia_ocupacoes_v2.md
-- Idempotente: ON CONFLICT (slug) DO UPDATE (mesmo padrão 0098).
-- ============================================================

BEGIN;

INSERT INTO categories (
  parent_id,
  name,
  slug,
  description,
  level,
  path,
  scope,
  status,
  is_active
)
SELECT
  p.category_id,
  'Beleza & Estética',
  'beleza-estetica',
  'Salão, imagem pessoal, cuidados estéticos (não confundir com esteticista automotivo)',
  1,
  ARRAY['profissoes']::text[],
  'professional',
  'active',
  true
FROM categories p
WHERE p.slug = 'profissoes'
  AND p.scope = 'professional'
  AND p.level = 0
ON CONFLICT (slug) DO UPDATE SET
  scope = EXCLUDED.scope,
  level = EXCLUDED.level,
  parent_id = EXCLUDED.parent_id,
  description = EXCLUDED.description,
  path = EXCLUDED.path,
  status = EXCLUDED.status,
  is_active = EXCLUDED.is_active;

COMMIT;
