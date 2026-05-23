BEGIN;

ALTER TABLE tenants
ADD COLUMN company_type_id UUID
  REFERENCES company_types(id)
  ON DELETE NO ACTION;

COMMIT;
