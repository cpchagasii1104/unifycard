BEGIN;

CREATE TABLE company_type_allowed_concepts (
  company_type_id UUID NOT NULL
    REFERENCES company_types(id)
    ON DELETE CASCADE,

  concept_id UUID NOT NULL
    REFERENCES concepts(concept_id)
    ON DELETE CASCADE,

  CONSTRAINT company_type_allowed_unique
    UNIQUE (company_type_id, concept_id)
);

COMMIT;
