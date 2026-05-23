-- ============================================================
-- 0095: reparar bootstrap profissional (bases que já rodaram 0094 antiga)
-- ============================================================
-- A 0094 original usava NOT EXISTS só por slug; se `saude`/`medicina` já existissem
-- como global, o INSERT era ignorado e N2 nunca era criado (UNIQUE(slug) impede
-- segunda linha). Esta migration aplica a mesma lógica corrigida (upsert N0/N1 + N2).
-- Idempotente: seguro repetir.
-- ============================================================

BEGIN;

SELECT set_config('app.concept_governance', 'true', true);

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
