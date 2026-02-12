-- Migration 112: CPF Phase 0 Hardening (imutabilidade + preservação + soft delete)
-- Data: 2026-01-03
-- Objetivo:
--   1) Remover ON DELETE CASCADE de user_profiles -> users (CPF não pode sumir ao apagar usuário)
--   2) Adicionar soft delete em users (deleted_at)
--   3) Bloquear UPDATE de CPF no banco (imutabilidade em nível nuclear)

BEGIN;

-- 1) Soft delete em users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS users_deleted_at_idx ON users (deleted_at);

-- 2) Remover FK com CASCADE e recriar como RESTRICT/NO ACTION
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT c.conname INTO fk_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'user_profiles'
    AND c.contype = 'f'
    AND c.confrelid = 'users'::regclass
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE user_profiles DROP CONSTRAINT %I', fk_name);
  END IF;

  -- Recriar FK sem cascade
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c2
    JOIN pg_class t2 ON t2.oid = c2.conrelid
    WHERE t2.relname = 'user_profiles'
      AND c2.contype = 'f'
      AND c2.confrelid = 'users'::regclass
  ) THEN
    ALTER TABLE user_profiles
      ADD CONSTRAINT user_profiles_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES users(user_id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- 3) Imutabilidade do CPF em nível de banco
--    (usuário nunca muda CPF; suporte/admin deve usar fluxo controlado fora do escopo desta fase)
CREATE OR REPLACE FUNCTION prevent_user_profiles_cpf_update()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.cpf IS DISTINCT FROM OLD.cpf THEN
    RAISE EXCEPTION 'CPF é imutável após o cadastro';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_prevent_user_profiles_cpf_update'
  ) THEN
    CREATE TRIGGER trg_prevent_user_profiles_cpf_update
      BEFORE UPDATE OF cpf ON user_profiles
      FOR EACH ROW
      EXECUTE FUNCTION prevent_user_profiles_cpf_update();
  END IF;
END $$;

COMMIT;
