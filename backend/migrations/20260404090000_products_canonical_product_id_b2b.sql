-- Pré-requisito para backfill B2B: alinhar variantes ao canónico na linha.
-- Não altera a tabela canonical_products; apenas products (catálogo por tenant).
BEGIN;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS canonical_product_id UUID;

COMMENT ON COLUMN products.canonical_product_id IS
  'Referência ao produto canónico (quando aplicável); usado em linhas B2B e matching de variantes.';

COMMIT;
