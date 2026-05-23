-- ============================================================
-- 0094: bootstrap mínimo profissional (saude > medicina > 3 N2)
-- ============================================================
-- Objetivo: destravar autocomplete com um conjunto mínimo e idempotente.
-- Escopo fechado:
-- - N0: saude
-- - N1: medicina
-- - N2: medico-clinico-geral, medico-cardiologista, medico-pediatra
-- Regras:
-- - sem alterar schema
-- - UNIQUE(slug): não pode haver duas linhas com o mesmo slug; se `saude`/`medicina`
--   já existirem (ex.: scope global), promove-se a árvore profissional via ON CONFLICT.
-- - N2 sempre com concept_id
-- Path canónico (CategoryModel.normalizePath): apenas ancestrais; path.length = level
--   (não incluir o próprio slug; level 0 ignora path na leitura).
-- ============================================================

BEGIN;

SELECT set_config('app.concept_governance', 'true', true);

-- PASSO 1: garantir concepts dos N2 (domain N0 oficial: servicos).
INSERT INTO concepts (slug, domain)
SELECT v.slug, 'servicos'
FROM (
  VALUES
    ('medico-clinico-geral'),
    ('medico-cardiologista'),
    ('medico-pediatra')
) AS v(slug)
WHERE NOT EXISTS (
  SELECT 1
  FROM concepts c
  WHERE c.slug = v.slug
    AND c.domain = 'servicos'
);

-- PASSO 2: N0 (level 0) professional — insert ou promover linha existente com slug saude.
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
VALUES (
  NULL,
  'Saúde',
  'saude',
  'Área de saúde',
  0,
  ARRAY['saude']::text[],
  'professional',
  'active',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  scope = EXCLUDED.scope,
  level = EXCLUDED.level,
  parent_id = EXCLUDED.parent_id,
  description = EXCLUDED.description,
  path = EXCLUDED.path,
  status = EXCLUDED.status,
  is_active = EXCLUDED.is_active;

-- PASSO 3: N1 (level 1) professional sob saude.
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
  s.category_id AS parent_id,
  'Medicina' AS name,
  'medicina' AS slug,
  'Especialidades médicas' AS description,
  1 AS level,
  ARRAY['saude']::text[] AS path,
  'professional' AS scope,
  'active' AS status,
  true AS is_active
FROM categories s
WHERE s.slug = 'saude'
ON CONFLICT (slug) DO UPDATE SET
  scope = EXCLUDED.scope,
  level = EXCLUDED.level,
  parent_id = EXCLUDED.parent_id,
  description = EXCLUDED.description,
  path = EXCLUDED.path,
  status = EXCLUDED.status,
  is_active = EXCLUDED.is_active;

-- PASSO 4: N2 (level 2) com concept_id obrigatório.
WITH seed_n2 AS (
  SELECT *
  FROM (
    VALUES
      ('medico-clinico-geral', 'Médico Clínico Geral', 'Atendimento clínico geral'),
      ('medico-cardiologista', 'Médico Cardiologista', 'Especialista em cardiologia'),
      ('medico-pediatra', 'Médico Pediatra', 'Especialista em pediatria')
  ) AS v(slug, name, description)
),
med_parent AS (
  SELECT category_id
  FROM categories
  WHERE slug = 'medicina'
    AND scope = 'professional'
    AND level = 1
),
concepts_n2 AS (
  SELECT c.slug, c.concept_id
  FROM concepts c
  WHERE c.domain = 'servicos'
    AND c.slug IN (
      'medico-clinico-geral',
      'medico-cardiologista',
      'medico-pediatra'
    )
)
INSERT INTO categories (
  parent_id,
  name,
  slug,
  description,
  level,
  path,
  scope,
  status,
  is_active,
  concept_id
)
SELECT
  mp.category_id AS parent_id,
  s.name,
  s.slug,
  s.description,
  2 AS level,
  ARRAY['saude', 'medicina']::text[] AS path,
  'professional' AS scope,
  'active' AS status,
  true AS is_active,
  cn.concept_id
FROM med_parent mp
JOIN seed_n2 s ON TRUE
JOIN concepts_n2 cn ON cn.slug = s.slug
WHERE NOT EXISTS (
  SELECT 1
  FROM categories c
  WHERE c.slug = s.slug
);

COMMIT;
