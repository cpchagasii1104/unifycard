BEGIN;

ALTER TABLE company_users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_company_users_updated_at ON company_users;
CREATE TRIGGER trg_company_users_updated_at
  BEFORE UPDATE ON company_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;
