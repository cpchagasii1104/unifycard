BEGIN;

-- =========================
-- users (já tem created_at / updated_at)
-- =========================

ALTER TABLE users
  DROP COLUMN IF EXISTS "createdAt",
  DROP COLUMN IF EXISTS "updatedAt";


-- =========================
-- tenant_contexts (já tem created_at)
-- =========================

ALTER TABLE tenant_contexts
  DROP COLUMN IF EXISTS "createdAt";


-- =========================
-- global_users (só camelCase antes)
-- =========================

ALTER TABLE global_users
  DROP COLUMN IF EXISTS "createdAt",
  DROP COLUMN IF EXISTS "updatedAt";

ALTER TABLE global_users
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();


-- trigger updated_at

CREATE OR REPLACE FUNCTION global_users_bump_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_global_users_updated_at ON global_users;

CREATE TRIGGER trg_global_users_updated_at
BEFORE UPDATE ON global_users
FOR EACH ROW
EXECUTE FUNCTION global_users_bump_updated_at();


-- =========================
-- profiles (só camelCase antes)
-- =========================

ALTER TABLE profiles
  DROP COLUMN IF EXISTS "createdAt",
  DROP COLUMN IF EXISTS "updatedAt";

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();


-- trigger updated_at

CREATE OR REPLACE FUNCTION profiles_bump_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION profiles_bump_updated_at();

COMMIT;
