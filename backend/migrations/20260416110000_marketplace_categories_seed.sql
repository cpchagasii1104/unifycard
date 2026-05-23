-- ============================================================
-- 20260416110000: seed categorias marketplace (global, pós-0092)
-- metadata.domain = marketplace; taxonomy department | branch
-- path: level 0 → [] (CategoryModel ignora); level 1 → 1 ancestral (slug do parent)
-- ============================================================

BEGIN;

INSERT INTO categories (
  category_id, parent_id, name, slug, description,
  level, path, scope, status, is_active, metadata
) VALUES
  (
    '11100000-0000-0000-0000-000000000001',
    NULL,
    'Alimentação',
    'marketplace-alimentacao',
    'Produtos alimentícios e bebidas',
    0, ARRAY[]::text[], 'global', 'active', true,
    '{"domain": "marketplace", "taxonomy": "department"}'::jsonb
  ),
  (
    '11100000-0000-0000-0000-000000000002',
    NULL,
    'Saúde e Beleza',
    'marketplace-saude-beleza',
    'Produtos de saúde, higiene e beleza',
    0, ARRAY[]::text[], 'global', 'active', true,
    '{"domain": "marketplace", "taxonomy": "department"}'::jsonb
  ),
  (
    '11100000-0000-0000-0000-000000000003',
    NULL,
    'Serviços Pessoais',
    'marketplace-servicos-pessoais',
    'Salão, barbearia, estética e afins',
    0, ARRAY[]::text[], 'global', 'active', true,
    '{"domain": "marketplace", "taxonomy": "department"}'::jsonb
  )
ON CONFLICT (slug) DO UPDATE SET
  metadata    = EXCLUDED.metadata,
  is_active   = EXCLUDED.is_active,
  description = EXCLUDED.description,
  path        = EXCLUDED.path,
  level       = EXCLUDED.level;

INSERT INTO categories (
  category_id, parent_id, name, slug, description,
  level, path, scope, status, is_active, metadata
) VALUES
  (
    '11100000-0000-0000-0000-000000000010',
    '11100000-0000-0000-0000-000000000001',
    'Hortifruti',
    'marketplace-hortifruti',
    'Frutas, verduras e legumes',
    1, ARRAY['marketplace-alimentacao']::text[],
    'global', 'active', true,
    '{"domain": "marketplace", "taxonomy": "branch", "company_types": ["hortifruti", "supermercado"]}'::jsonb
  ),
  (
    '11100000-0000-0000-0000-000000000011',
    '11100000-0000-0000-0000-000000000001',
    'Carnes e Aves',
    'marketplace-carnes-aves',
    'Açougue, carnes bovinas, suínas e aves',
    1, ARRAY['marketplace-alimentacao']::text[],
    'global', 'active', true,
    '{"domain": "marketplace", "taxonomy": "branch", "company_types": ["açougue", "supermercado"]}'::jsonb
  ),
  (
    '11100000-0000-0000-0000-000000000012',
    '11100000-0000-0000-0000-000000000001',
    'Padaria e Confeitaria',
    'marketplace-padaria-confeitaria',
    'Pães, bolos, doces e salgados',
    1, ARRAY['marketplace-alimentacao']::text[],
    'global', 'active', true,
    '{"domain": "marketplace", "taxonomy": "branch", "company_types": ["padaria", "supermercado"]}'::jsonb
  ),
  (
    '11100000-0000-0000-0000-000000000013',
    '11100000-0000-0000-0000-000000000001',
    'Mercearia',
    'marketplace-mercearia',
    'Produtos de mercearia, grãos e conservas',
    1, ARRAY['marketplace-alimentacao']::text[],
    'global', 'active', true,
    '{"domain": "marketplace", "taxonomy": "branch", "company_types": ["supermercado"]}'::jsonb
  ),
  (
    '11100000-0000-0000-0000-000000000014',
    '11100000-0000-0000-0000-000000000001',
    'Bebidas',
    'marketplace-bebidas',
    'Bebidas em geral',
    1, ARRAY['marketplace-alimentacao']::text[],
    'global', 'active', true,
    '{"domain": "marketplace", "taxonomy": "branch", "company_types": ["supermercado", "padaria"]}'::jsonb
  ),
  (
    '11100000-0000-0000-0000-000000000015',
    '11100000-0000-0000-0000-000000000001',
    'Limpeza',
    'marketplace-limpeza',
    'Produtos de limpeza doméstica',
    1, ARRAY['marketplace-alimentacao']::text[],
    'global', 'active', true,
    '{"domain": "marketplace", "taxonomy": "branch", "company_types": ["supermercado"]}'::jsonb
  )
ON CONFLICT (slug) DO UPDATE SET
  metadata    = EXCLUDED.metadata,
  is_active   = EXCLUDED.is_active,
  parent_id   = EXCLUDED.parent_id,
  description = EXCLUDED.description,
  path        = EXCLUDED.path,
  level       = EXCLUDED.level;

INSERT INTO categories (
  category_id, parent_id, name, slug, description,
  level, path, scope, status, is_active, metadata
) VALUES
  (
    '11100000-0000-0000-0000-000000000020',
    '11100000-0000-0000-0000-000000000002',
    'Medicamentos e Suplementos',
    'marketplace-medicamentos-suplementos',
    'Medicamentos, vitaminas e suplementos',
    1, ARRAY['marketplace-saude-beleza']::text[],
    'global', 'active', true,
    '{"domain": "marketplace", "taxonomy": "branch", "company_types": ["farmácia"]}'::jsonb
  ),
  (
    '11100000-0000-0000-0000-000000000021',
    '11100000-0000-0000-0000-000000000002',
    'Higiene Pessoal',
    'marketplace-higiene-pessoal',
    'Produtos de higiene e cuidado pessoal',
    1, ARRAY['marketplace-saude-beleza']::text[],
    'global', 'active', true,
    '{"domain": "marketplace", "taxonomy": "branch", "company_types": ["farmácia", "supermercado"]}'::jsonb
  ),
  (
    '11100000-0000-0000-0000-000000000022',
    '11100000-0000-0000-0000-000000000002',
    'Cosméticos e Beleza',
    'marketplace-cosmeticos-beleza',
    'Maquiagem, perfumes e produtos de beleza',
    1, ARRAY['marketplace-saude-beleza']::text[],
    'global', 'active', true,
    '{"domain": "marketplace", "taxonomy": "branch", "company_types": ["salão", "farmácia"]}'::jsonb
  )
ON CONFLICT (slug) DO UPDATE SET
  metadata    = EXCLUDED.metadata,
  is_active   = EXCLUDED.is_active,
  parent_id   = EXCLUDED.parent_id,
  description = EXCLUDED.description,
  path        = EXCLUDED.path,
  level       = EXCLUDED.level;

INSERT INTO categories (
  category_id, parent_id, name, slug, description,
  level, path, scope, status, is_active, metadata
) VALUES
  (
    '11100000-0000-0000-0000-000000000030',
    '11100000-0000-0000-0000-000000000003',
    'Cabelo',
    'marketplace-cabelo',
    'Corte, coloração e tratamento capilar',
    1, ARRAY['marketplace-servicos-pessoais']::text[],
    'global', 'active', true,
    '{"domain": "marketplace", "taxonomy": "branch", "company_types": ["salão"]}'::jsonb
  ),
  (
    '11100000-0000-0000-0000-000000000031',
    '11100000-0000-0000-0000-000000000003',
    'Estética e Spa',
    'marketplace-estetica-spa',
    'Tratamentos estéticos, massagens e spa',
    1, ARRAY['marketplace-servicos-pessoais']::text[],
    'global', 'active', true,
    '{"domain": "marketplace", "taxonomy": "branch", "company_types": ["salão"]}'::jsonb
  ),
  (
    '11100000-0000-0000-0000-000000000032',
    '11100000-0000-0000-0000-000000000003',
    'Barbearia',
    'marketplace-barbearia',
    'Corte masculino, barba e bigode',
    1, ARRAY['marketplace-servicos-pessoais']::text[],
    'global', 'active', true,
    '{"domain": "marketplace", "taxonomy": "branch", "company_types": ["salão"]}'::jsonb
  )
ON CONFLICT (slug) DO UPDATE SET
  metadata    = EXCLUDED.metadata,
  is_active   = EXCLUDED.is_active,
  parent_id   = EXCLUDED.parent_id,
  description = EXCLUDED.description,
  path        = EXCLUDED.path,
  level       = EXCLUDED.level;

-- category_n1_mapping (PLANO_EXECUCAO_SEED.md — governança N1)
SELECT set_config('app.n1_governance', 'true', true);

INSERT INTO category_n1_mapping (category_id, n1_id)
SELECT c.category_id, n.n1_id
FROM categories c, n1_nodes n
WHERE c.slug = 'marketplace-hortifruti' AND n.slug = 'alimentacao' AND n.domain_key = 'produtos-e-comercio'
ON CONFLICT (category_id) DO NOTHING;

INSERT INTO category_n1_mapping (category_id, n1_id)
SELECT c.category_id, n.n1_id
FROM categories c, n1_nodes n
WHERE c.slug = 'marketplace-carnes-aves' AND n.slug = 'alimentacao' AND n.domain_key = 'produtos-e-comercio'
ON CONFLICT (category_id) DO NOTHING;

INSERT INTO category_n1_mapping (category_id, n1_id)
SELECT c.category_id, n.n1_id
FROM categories c, n1_nodes n
WHERE c.slug = 'marketplace-padaria-confeitaria' AND n.slug = 'alimentacao' AND n.domain_key = 'produtos-e-comercio'
ON CONFLICT (category_id) DO NOTHING;

INSERT INTO category_n1_mapping (category_id, n1_id)
SELECT c.category_id, n.n1_id
FROM categories c, n1_nodes n
WHERE c.slug = 'marketplace-mercearia' AND n.slug = 'alimentacao' AND n.domain_key = 'produtos-e-comercio'
ON CONFLICT (category_id) DO NOTHING;

INSERT INTO category_n1_mapping (category_id, n1_id)
SELECT c.category_id, n.n1_id
FROM categories c, n1_nodes n
WHERE c.slug = 'marketplace-bebidas' AND n.slug = 'bebidas' AND n.domain_key = 'produtos-e-comercio'
ON CONFLICT (category_id) DO NOTHING;

INSERT INTO category_n1_mapping (category_id, n1_id)
SELECT c.category_id, n.n1_id
FROM categories c, n1_nodes n
WHERE c.slug = 'marketplace-limpeza' AND n.slug = 'higiene-e-beleza' AND n.domain_key = 'produtos-e-comercio'
ON CONFLICT (category_id) DO NOTHING;

INSERT INTO category_n1_mapping (category_id, n1_id)
SELECT c.category_id, n.n1_id
FROM categories c, n1_nodes n
WHERE c.slug = 'marketplace-medicamentos-suplementos' AND n.slug = 'higiene-e-beleza' AND n.domain_key = 'produtos-e-comercio'
ON CONFLICT (category_id) DO NOTHING;

INSERT INTO category_n1_mapping (category_id, n1_id)
SELECT c.category_id, n.n1_id
FROM categories c, n1_nodes n
WHERE c.slug = 'marketplace-higiene-pessoal' AND n.slug = 'higiene-e-beleza' AND n.domain_key = 'produtos-e-comercio'
ON CONFLICT (category_id) DO NOTHING;

INSERT INTO category_n1_mapping (category_id, n1_id)
SELECT c.category_id, n.n1_id
FROM categories c, n1_nodes n
WHERE c.slug = 'marketplace-cosmeticos-beleza' AND n.slug = 'higiene-e-beleza' AND n.domain_key = 'produtos-e-comercio'
ON CONFLICT (category_id) DO NOTHING;

INSERT INTO category_n1_mapping (category_id, n1_id)
SELECT c.category_id, n.n1_id
FROM categories c, n1_nodes n
WHERE c.slug IN ('marketplace-cabelo','marketplace-estetica-spa','marketplace-barbearia')
  AND n.slug = 'higiene-e-beleza' AND n.domain_key = 'produtos-e-comercio'
ON CONFLICT (category_id) DO NOTHING;

INSERT INTO category_n1_mapping (category_id, n1_id)
SELECT c.category_id, n.n1_id
FROM categories c, n1_nodes n
WHERE c.slug = 'marketplace-alimentacao' AND n.slug = 'alimentacao' AND n.domain_key = 'produtos-e-comercio'
ON CONFLICT (category_id) DO NOTHING;

INSERT INTO category_n1_mapping (category_id, n1_id)
SELECT c.category_id, n.n1_id
FROM categories c, n1_nodes n
WHERE c.slug IN ('marketplace-saude-beleza','marketplace-servicos-pessoais')
  AND n.slug = 'higiene-e-beleza' AND n.domain_key = 'produtos-e-comercio'
ON CONFLICT (category_id) DO NOTHING;

COMMIT;
