-- ============================================================
-- 0058: Identidade de aplicação (global_users + users) e profiles por user_id
-- ============================================================
-- Fecha lacuna: código (auth, identity, profile.service) espera estas tabelas/colunas;
-- 0002 criou tenants/actors; 0008 criou profiles com actor_id (read model legado).
-- Esta migration adiciona o núcleo de utilizador da app e alinha profiles ao contrato usado no código.
-- ============================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- global_users: identidade global (CPF SSOT para UPSERT no registo)
-- ---------------------------------------------------------------------------
CREATE TABLE global_users (
  global_user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cpf TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  birthdate DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT global_users_cpf_key UNIQUE (cpf)
);

CREATE INDEX idx_global_users_cpf ON global_users (cpf);

COMMENT ON TABLE global_users IS
  'Identidade global por CPF; usada por auth.register e identity.service.';

-- ---------------------------------------------------------------------------
-- users: utilizador por tenant (JWT sub = id; código legado usa user_id = id)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id UUID NOT NULL,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  global_user_id UUID REFERENCES global_users (global_user_id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  token_version INTEGER NOT NULL DEFAULT 0,
  is_test BOOLEAN NOT NULL DEFAULT false,
  plan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_user_id_key UNIQUE (user_id),
  CONSTRAINT users_id_user_id_equal CHECK (id = user_id),
  CONSTRAINT users_tenant_email_key UNIQUE (tenant_id, email)
);

CREATE INDEX idx_users_tenant_id ON users (tenant_id);
CREATE INDEX idx_users_global_user_id ON users (global_user_id);

-- Permite INSERT só com id OU só com user_id (auth vs seeds); mantém id = user_id.
CREATE OR REPLACE FUNCTION users_sync_id_user_id()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.id := NEW.user_id;
  ELSIF NEW.user_id IS NULL AND NEW.id IS NOT NULL THEN
    NEW.user_id := NEW.id;
  ELSIF NEW.id IS NULL AND NEW.user_id IS NULL THEN
    NEW.id := uuid_generate_v4();
    NEW.user_id := NEW.id;
  END IF;
  IF NEW.id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'users.id and users.user_id must be equal';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_sync_id_user_id
  BEFORE INSERT OR UPDATE OF id, user_id ON users
  FOR EACH ROW
  EXECUTE FUNCTION users_sync_id_user_id();

COMMENT ON TABLE users IS
  'Utilizador por tenant; id e user_id são o mesmo UUID (contrato auth + legado).';

-- ---------------------------------------------------------------------------
-- profiles: substitui 0008 (actor_id) pelo modelo esperado pelo profile.service
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS profiles CASCADE;

CREATE TABLE profiles (
  profile_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  full_name VARCHAR(255),
  phone TEXT,
  cpf TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  profile_personal_confirmed BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_tenant_user_key UNIQUE (tenant_id, user_id),
  CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_profiles_tenant_id ON profiles (tenant_id);
CREATE INDEX idx_profiles_user_id ON profiles (user_id);

COMMIT;
