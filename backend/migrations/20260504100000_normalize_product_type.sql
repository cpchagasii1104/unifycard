-- Fase 5A: normalizar valores de products.product_type para maiúsculas (ex.: industrial → INDUSTRIAL).
-- Sem CHECK novo — apenas dados existentes + alinhamento ao código.

BEGIN;

UPDATE products
SET product_type = UPPER(product_type)
WHERE product_type IS NOT NULL
  AND product_type != UPPER(product_type);

COMMIT;
