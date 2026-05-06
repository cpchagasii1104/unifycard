SELECT COUNT(*) AS concepts_e2e FROM concepts WHERE slug LIKE 'bloco3-e2e-%';
SELECT COUNT(*) AS canon_e2e FROM canonical_products WHERE name LIKE '%E2E scaffold%';
SELECT cat.slug, con.slug AS concept_slug
FROM categories cat
LEFT JOIN concepts con
  ON con.domain = 'item-comercial'
 AND con.slug = 'bloco3-e2e-' || replace(cat.category_id::text, '-', '')
WHERE cat.slug LIKE 'cat-e2e-%'
LIMIT 5;
