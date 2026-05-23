-- ============================================================
-- 20260418100000: categorias operacionais N0 servicos (arvore global)
-- Alinhado a: n1_nodes em 0078_n1_navigation.sql (slugs canonicos — NAO inventar N1)
-- Padrao: marketplace (metadata.domain + taxonomy department|branch)
-- UUID block 11200000-* (distinto de marketplace 11100000-*)
-- ============================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Departments (level 0) — entrada por area de N1 servicos
-- ---------------------------------------------------------------------------
INSERT INTO categories (
  category_id, parent_id, name, slug, description,
  level, path, scope, status, is_active, metadata
) VALUES
  (
    '11200000-0000-0000-0000-000000000101',
    NULL,
    'Manutenção e reformas',
    'servicos-manutencao-reformas',
    'Reformas, reparos e obras leves',
    0, ARRAY[]::text[], 'global', 'active', true,
    '{"domain": "servicos", "taxonomy": "department", "n0": "servicos"}'::jsonb
  ),
  (
    '11200000-0000-0000-0000-000000000102',
    NULL,
    'Serviços para o lar',
    'servicos-para-o-lar',
    'Limpeza, jardinagem e servicos domesticos',
    0, ARRAY[]::text[], 'global', 'active', true,
    '{"domain": "servicos", "taxonomy": "department", "n0": "servicos"}'::jsonb
  ),
  (
    '11200000-0000-0000-0000-000000000103',
    NULL,
    'Estética e bem-estar',
    'servicos-estetica-bem-estar',
    'Beleza, estetica e cuidados pessoais presenciais',
    0, ARRAY[]::text[], 'global', 'active', true,
    '{"domain": "servicos", "taxonomy": "department", "n0": "servicos"}'::jsonb
  ),
  (
    '11200000-0000-0000-0000-000000000104',
    NULL,
    'Serviços técnicos',
    'servicos-tecnicos-gerais',
    'Tecnicos especializados e suporte tecnico',
    0, ARRAY[]::text[], 'global', 'active', true,
    '{"domain": "servicos", "taxonomy": "department", "n0": "servicos"}'::jsonb
  )
ON CONFLICT (slug) DO UPDATE SET
  metadata    = EXCLUDED.metadata,
  is_active   = EXCLUDED.is_active,
  description = EXCLUDED.description,
  path        = EXCLUDED.path,
  level       = EXCLUDED.level;

-- ---------------------------------------------------------------------------
-- Branches (level 1) — N2 estruturais (nao intent)
-- ---------------------------------------------------------------------------
INSERT INTO categories (
  category_id, parent_id, name, slug, description,
  level, path, scope, status, is_active, metadata
) VALUES
  (
    '11200000-0000-0000-0000-000000000111',
    '11200000-0000-0000-0000-000000000101',
    'Pedreiro',
    'servicos-pedreiro',
    'Alvenaria, reboco e pequenas obras',
    1, ARRAY['servicos-manutencao-reformas']::text[],
    'global', 'active', true,
    '{"domain": "servicos", "taxonomy": "branch", "n0": "servicos"}'::jsonb
  ),
  (
    '11200000-0000-0000-0000-000000000112',
    '11200000-0000-0000-0000-000000000101',
    'Eletricista residencial',
    'servicos-eletricista-residencial',
    'Instalacoes e reparos eletricos',
    1, ARRAY['servicos-manutencao-reformas']::text[],
    'global', 'active', true,
    '{"domain": "servicos", "taxonomy": "branch", "n0": "servicos"}'::jsonb
  ),
  (
    '11200000-0000-0000-0000-000000000113',
    '11200000-0000-0000-0000-000000000101',
    'Encanador',
    'servicos-encanador',
    'Hidraulica e vazamentos',
    1, ARRAY['servicos-manutencao-reformas']::text[],
    'global', 'active', true,
    '{"domain": "servicos", "taxonomy": "branch", "n0": "servicos"}'::jsonb
  ),
  (
    '11200000-0000-0000-0000-000000000114',
    '11200000-0000-0000-0000-000000000101',
    'Pintura',
    'servicos-pintura',
    'Pintura interna e externa',
    1, ARRAY['servicos-manutencao-reformas']::text[],
    'global', 'active', true,
    '{"domain": "servicos", "taxonomy": "branch", "n0": "servicos"}'::jsonb
  ),
  (
    '11200000-0000-0000-0000-000000000121',
    '11200000-0000-0000-0000-000000000102',
    'Limpeza residencial',
    'servicos-limpeza-residencial',
    'Limpeza de casas e apartamentos',
    1, ARRAY['servicos-para-o-lar']::text[],
    'global', 'active', true,
    '{"domain": "servicos", "taxonomy": "branch", "n0": "servicos"}'::jsonb
  ),
  (
    '11200000-0000-0000-0000-000000000122',
    '11200000-0000-0000-0000-000000000102',
    'Jardinagem',
    'servicos-jardinagem',
    'Jardins, gramados e paisagismo leve',
    1, ARRAY['servicos-para-o-lar']::text[],
    'global', 'active', true,
    '{"domain": "servicos", "taxonomy": "branch", "n0": "servicos"}'::jsonb
  ),
  (
    '11200000-0000-0000-0000-000000000131',
    '11200000-0000-0000-0000-000000000103',
    'Manicure e pedicure',
    'servicos-manicure',
    'Cuidados com unhas',
    1, ARRAY['servicos-estetica-bem-estar']::text[],
    'global', 'active', true,
    '{"domain": "servicos", "taxonomy": "branch", "n0": "servicos"}'::jsonb
  ),
  (
    '11200000-0000-0000-0000-000000000132',
    '11200000-0000-0000-0000-000000000103',
    'Cabeleireiro',
    'servicos-cabeleireiro',
    'Corte, coloracao e tratamento capilar',
    1, ARRAY['servicos-estetica-bem-estar']::text[],
    'global', 'active', true,
    '{"domain": "servicos", "taxonomy": "branch", "n0": "servicos"}'::jsonb
  ),
  (
    '11200000-0000-0000-0000-000000000133',
    '11200000-0000-0000-0000-000000000103',
    'Barbearia',
    'servicos-barbearia',
    'Corte masculino e barba',
    1, ARRAY['servicos-estetica-bem-estar']::text[],
    'global', 'active', true,
    '{"domain": "servicos", "taxonomy": "branch", "n0": "servicos"}'::jsonb
  ),
  (
    '11200000-0000-0000-0000-000000000134',
    '11200000-0000-0000-0000-000000000103',
    'Estética facial',
    'servicos-estetica-facial',
    'Tratamentos faciais e skincare',
    1, ARRAY['servicos-estetica-bem-estar']::text[],
    'global', 'active', true,
    '{"domain": "servicos", "taxonomy": "branch", "n0": "servicos"}'::jsonb
  ),
  (
    '11200000-0000-0000-0000-000000000141',
    '11200000-0000-0000-0000-000000000104',
    'Ar-condicionado',
    'servicos-ar-condicionado',
    'Instalacao e manutencao de climatizacao',
    1, ARRAY['servicos-tecnicos-gerais']::text[],
    'global', 'active', true,
    '{"domain": "servicos", "taxonomy": "branch", "n0": "servicos"}'::jsonb
  ),
  (
    '11200000-0000-0000-0000-000000000142',
    '11200000-0000-0000-0000-000000000104',
    'Informática e suporte',
    'servicos-informatica-suporte',
    'Computadores, redes e suporte em domicilio',
    1, ARRAY['servicos-tecnicos-gerais']::text[],
    'global', 'active', true,
    '{"domain": "servicos", "taxonomy": "branch", "n0": "servicos"}'::jsonb
  )
ON CONFLICT (slug) DO UPDATE SET
  metadata    = EXCLUDED.metadata,
  is_active   = EXCLUDED.is_active,
  parent_id   = EXCLUDED.parent_id,
  description = EXCLUDED.description,
  path        = EXCLUDED.path,
  level       = EXCLUDED.level;

-- ---------------------------------------------------------------------------
-- category_n1_mapping — N1 = slugs de 0078 (domain_key = servicos)
-- ---------------------------------------------------------------------------
SELECT set_config('app.n1_governance', 'true', true);

-- manutencao-e-reformas
INSERT INTO category_n1_mapping (category_id, n1_id)
SELECT c.category_id, n.n1_id
FROM categories c, n1_nodes n
WHERE c.slug IN (
    'servicos-manutencao-reformas',
    'servicos-pedreiro',
    'servicos-eletricista-residencial',
    'servicos-encanador',
    'servicos-pintura'
  )
  AND n.slug = 'manutencao-e-reformas'
  AND n.domain_key = 'servicos'
ON CONFLICT (category_id) DO NOTHING;

-- servicos-domesticos
INSERT INTO category_n1_mapping (category_id, n1_id)
SELECT c.category_id, n.n1_id
FROM categories c, n1_nodes n
WHERE c.slug IN ('servicos-para-o-lar', 'servicos-limpeza-residencial', 'servicos-jardinagem')
  AND n.slug = 'servicos-domesticos'
  AND n.domain_key = 'servicos'
ON CONFLICT (category_id) DO NOTHING;

-- estetica-e-cuidados-pessoais
INSERT INTO category_n1_mapping (category_id, n1_id)
SELECT c.category_id, n.n1_id
FROM categories c, n1_nodes n
WHERE c.slug IN (
    'servicos-estetica-bem-estar',
    'servicos-manicure',
    'servicos-cabeleireiro',
    'servicos-barbearia',
    'servicos-estetica-facial'
  )
  AND n.slug = 'estetica-e-cuidados-pessoais'
  AND n.domain_key = 'servicos'
ON CONFLICT (category_id) DO NOTHING;

-- servicos-tecnicos-especializados
INSERT INTO category_n1_mapping (category_id, n1_id)
SELECT c.category_id, n.n1_id
FROM categories c, n1_nodes n
WHERE c.slug IN ('servicos-tecnicos-gerais', 'servicos-ar-condicionado', 'servicos-informatica-suporte')
  AND n.slug = 'servicos-tecnicos-especializados'
  AND n.domain_key = 'servicos'
ON CONFLICT (category_id) DO NOTHING;

COMMIT;
