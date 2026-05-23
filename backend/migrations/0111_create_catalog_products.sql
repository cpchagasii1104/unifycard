BEGIN;

CREATE TABLE catalog_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  concept_id UUID NOT NULL
    REFERENCES concepts(concept_id)
    ON DELETE NO ACTION,

  name TEXT,
  image_url TEXT,

  metadata JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT catalog_products_concept_unique UNIQUE (concept_id)
);

COMMIT;
