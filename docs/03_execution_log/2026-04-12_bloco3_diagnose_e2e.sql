SELECT slug,
  (SELECT count(*)::int FROM products p WHERE p.category_id = c.category_id) AS products,
  (SELECT count(*)::int FROM categories ch WHERE ch.parent_id = c.category_id) AS children
FROM categories c
WHERE c.slug LIKE 'cat-e2e-%'
LIMIT 10;
