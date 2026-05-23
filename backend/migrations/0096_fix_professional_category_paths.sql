-- ============================================================
-- 0096: alinhar path ao contrato CategoryModel (ancestrais só)
-- ============================================================
-- Erro: "path.length (2) != level (1)" em medicina — o seed usou caminho
-- materializado até o nó; o canónico exige path.length = level (slugs dos
-- pais apenas). Ver categories.model.ts normalizePath.
-- ============================================================

BEGIN;

UPDATE categories
SET path = ARRAY['saude']::text[]
WHERE slug = 'medicina'
  AND level = 1
  AND scope = 'professional';

UPDATE categories
SET path = ARRAY['saude', 'medicina']::text[]
WHERE slug IN (
  'medico-clinico-geral',
  'medico-cardiologista',
  'medico-pediatra'
)
  AND level = 2
  AND scope = 'professional';

COMMIT;
