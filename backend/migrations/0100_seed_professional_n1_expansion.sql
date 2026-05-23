-- ============================================================
-- 0100: N1 assistencia-domiciliar, jardinagem-manutencao, limpeza-servicos
-- ============================================================
-- Taxonomia v2.2 — docs/01_normative/taxonomia_ocupacoes_v2.md
-- Idempotente: ON CONFLICT (slug) DO UPDATE (padrão 0098/0099).
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
  'Assistência domiciliar (não clínica)',
  'assistencia-domiciliar',
  'Cuidado e apoio no lar — não confundir com enfermagem ou registros clínicos',
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
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  path = EXCLUDED.path,
  status = EXCLUDED.status,
  is_active = EXCLUDED.is_active;

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
  'Jardinagem e manutenção de áreas verdes',
  'jardinagem-manutencao',
  'Áreas verdes urbanas e condomínios — não agronegócio nem obra civil',
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
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  path = EXCLUDED.path,
  status = EXCLUDED.status,
  is_active = EXCLUDED.is_active;

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
  'Limpeza e facilities',
  'limpeza-servicos',
  'Limpeza predial, pós-obra e serviços especializados — não gastronomia',
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
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  path = EXCLUDED.path,
  status = EXCLUDED.status,
  is_active = EXCLUDED.is_active;

COMMIT;
