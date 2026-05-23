BEGIN;

INSERT INTO catalog_products (concept_id, name)
SELECT concept_id, slug
FROM concepts
ON CONFLICT (concept_id) DO NOTHING;

COMMIT;
