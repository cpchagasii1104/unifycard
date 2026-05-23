-- Bloco 3 — categorias `cat-e2e-*` retêm produtos de teste; não é seguro DELETE.
-- Garante 1 canónico global READY por categoria E2E para satisfazer a query de órfãs §3C (auditável).

BEGIN;

SELECT set_config('app.concept_governance', 'true', true);

INSERT INTO concepts (slug, domain)
SELECT 'bloco3-e2e-' || replace(cat.category_id::text, '-', ''), 'item-comercial'
FROM categories cat
WHERE cat.slug LIKE 'cat-e2e-%'
ON CONFLICT (domain, slug) DO NOTHING;

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
  'Catálogo global (E2E scaffold) — ' || cat.slug,
  NULL,
  '[]'::jsonb,
  jsonb_build_object('bloco3_e2e_scaffold', true),
  cat.category_id,
  con.concept_id,
  'confirmed',
  NULL
FROM categories cat
JOIN concepts con
  ON con.domain = 'item-comercial'
 AND con.slug = 'bloco3-e2e-' || replace(cat.category_id::text, '-', '')
WHERE cat.slug LIKE 'cat-e2e-%'
  AND NOT EXISTS (
    SELECT 1
    FROM canonical_products x
    WHERE x.category_id = cat.category_id
      AND x.scope = 'global'
      AND x.concept_resolution_status = 'confirmed'
      AND x.concept_id IS NOT NULL
  );

COMMIT;
