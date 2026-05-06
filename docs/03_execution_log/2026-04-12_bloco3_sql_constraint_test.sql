-- #4 ORIENTACAO — INSERT INDUSTRIAL sem canonical deve falhar (chk_products_industrial_requires_canonical)
-- Inclui category_id para não falhar antes no NOT NULL da tabela.
BEGIN;
INSERT INTO products (id, tenant_id, name, product_type, category_id, canonical_product_id)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM tenants LIMIT 1),
  'Test',
  'INDUSTRIAL',
  (SELECT category_id FROM categories WHERE metadata->>'domain' = 'marketplace' LIMIT 1),
  NULL
);
ROLLBACK;
