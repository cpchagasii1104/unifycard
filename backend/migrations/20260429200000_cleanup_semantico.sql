-- Cleanup semântico pós-unificação: remove colunas/tabelas legadas (idempotente).
-- Não remove _deprecated_tenant_products.

BEGIN;

ALTER TABLE canonical_products
  DROP COLUMN IF EXISTS product_concept_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'product_concept_resolution_queue'
  ) THEN
    ALTER TABLE product_concept_resolution_queue
      DROP COLUMN IF EXISTS suggested_concept_id;
    ALTER TABLE product_concept_resolution_queue
      DROP COLUMN IF EXISTS resolved_by;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_deprecated_product_concept_resolution_queue'
  ) THEN
    ALTER TABLE _deprecated_product_concept_resolution_queue
      DROP COLUMN IF EXISTS suggested_concept_id;
    ALTER TABLE _deprecated_product_concept_resolution_queue
      DROP COLUMN IF EXISTS resolved_by;
  END IF;
END $$;

DROP TABLE IF EXISTS _deprecated_product_concepts;

-- `_deprecated_tenant_products` permanece; sem FK para catálogo legado antes de dropar a tabela órfã.
ALTER TABLE IF EXISTS _deprecated_tenant_products
  DROP CONSTRAINT IF EXISTS tenant_products_catalog_product_id_fkey;

DROP TABLE IF EXISTS _deprecated_catalog_products;

COMMIT;
