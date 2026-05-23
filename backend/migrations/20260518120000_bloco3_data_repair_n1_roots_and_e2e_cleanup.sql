-- Bloco 3 — reparação de dados (versionada, idempotente).
-- Objetivo: (1) remover categorias E2E órfãs `cat-e2e-%` sem referências; (2) garantir 1 canónico
-- global READY por categoria N1 raiz marketplace listada (contrato §3C / ORIENTACAO).
-- Não altera CHECKs nem schema de negócio; não usa UPDATE em massa em produtos.

BEGIN;

SELECT set_config('app.concept_governance', 'true', true);

-- ---------------------------------------------------------------------------
-- A) Limpeza E2E: categorias de teste sem dependentes de produto/filho
-- ---------------------------------------------------------------------------
DELETE FROM category_n1_mapping m
USING categories c
WHERE m.category_id = c.category_id
  AND c.slug LIKE 'cat-e2e-%';

DELETE FROM category_relations r
USING categories c
WHERE (r.from_category_id = c.category_id OR r.to_category_id = c.category_id)
  AND c.slug LIKE 'cat-e2e-%';

DELETE FROM canonical_products cp
USING categories c
WHERE cp.category_id = c.category_id
  AND c.slug LIKE 'cat-e2e-%';

DELETE FROM categories c
WHERE c.slug LIKE 'cat-e2e-%'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.category_id = c.category_id)
  AND NOT EXISTS (SELECT 1 FROM categories ch WHERE ch.parent_id = c.category_id);

-- ---------------------------------------------------------------------------
-- B) Concepts auxiliares (domain N0 = item-comercial) para scaffolds N1 raiz
-- ---------------------------------------------------------------------------
INSERT INTO concepts (slug, domain)
SELECT 'bloco3-root-' || s.slug, 'item-comercial'
FROM (
  VALUES
    ('marketplace-alimentacao'),
    ('marketplace-saude-beleza'),
    ('marketplace-servicos-pessoais'),
    ('marketplace-cabelo'),
    ('marketplace-estetica-spa'),
    ('marketplace-barbearia')
) AS s(slug)
ON CONFLICT (domain, slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- C) Canónico global READY por raiz (fingerprint via trigger; sem GTIN)
-- ---------------------------------------------------------------------------
INSERT INTO canonical_products (
  tenant_id,
  scope,
  type,
  name,
  brand,
  images,
  attributes,
  category_id,
  concept_id,
  concept_resolution_status,
  gtin
)
SELECT
  NULL,
  'global',
  'INDUSTRIAL',
  'Catálogo global (N1 raiz) — ' || cat.slug,
  NULL,
  '[]'::jsonb,
  '{}'::jsonb,
  cat.category_id,
  con.concept_id,
  'confirmed',
  NULL
FROM categories cat
JOIN concepts con
  ON con.domain = 'item-comercial'
 AND con.slug = 'bloco3-root-' || cat.slug
WHERE cat.slug IN (
    'marketplace-alimentacao',
    'marketplace-saude-beleza',
    'marketplace-servicos-pessoais',
    'marketplace-cabelo',
    'marketplace-estetica-spa',
    'marketplace-barbearia'
  )
  AND cat.metadata->>'domain' = 'marketplace'
  AND NOT EXISTS (
    SELECT 1
    FROM canonical_products x
    WHERE x.category_id = cat.category_id
      AND x.scope = 'global'
      AND x.concept_resolution_status = 'confirmed'
      AND x.concept_id IS NOT NULL
  );

COMMIT;
