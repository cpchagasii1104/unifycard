SELECT slug, metadata->>'domain' AS domain_meta
FROM categories
WHERE slug LIKE 'cat-e2e-%'
LIMIT 5;
