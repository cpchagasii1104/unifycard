SELECT cat.slug, cp.id, cp.scope, cp.concept_resolution_status, cp.concept_id IS NOT NULL AS has_concept
FROM categories cat
LEFT JOIN canonical_products cp
  ON cp.category_id = cat.category_id
  AND cp.scope = 'global'
  AND cp.concept_resolution_status = 'confirmed'
  AND cp.concept_id IS NOT NULL
WHERE cat.slug = 'cat-e2e-780e9e6a-3';
