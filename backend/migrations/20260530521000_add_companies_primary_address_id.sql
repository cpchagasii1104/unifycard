BEGIN;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS primary_address_id UUID
  REFERENCES addresses(address_id) ON DELETE SET NULL;

COMMIT;
