-- ============================================================
-- 20260416125500: category_n1_mapping para categorias marketplace
-- Backfill quando 20260416110000 já tinha sido aplicada sem este bloco.
-- Idempotente: ON CONFLICT DO NOTHING.
-- ============================================================

BEGIN;

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
