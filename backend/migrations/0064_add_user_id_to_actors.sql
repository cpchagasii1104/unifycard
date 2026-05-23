-- ============================================================
-- 0064: actors — alinhamento com domínio social (user_id, actor_id, slug, actor_type)
-- ============================================================
-- Contexto: código em actor.repository.ts espera colunas e valores que o schema
-- genesis + 0012 não expunha (user_id, actor_id, slug, actor_type 'user'/'page').
-- ============================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) actor_type: incluir valores usados pelo módulo social (mantendo legado)
-- ---------------------------------------------------------------------------
ALTER TABLE actors DROP CONSTRAINT IF EXISTS actors_actor_type_check;

ALTER TABLE actors ADD CONSTRAINT actors_actor_type_check CHECK (
  actor_type IN (
    'user',
    'page',
    'group',
    'channel',
    'actor_human',
    'actor_organizational',
    'actor_system',
    'person',
    'company',
    'system'
  )
);

-- ---------------------------------------------------------------------------
-- 2) Colunas esperadas pelo repositório social
-- ---------------------------------------------------------------------------
ALTER TABLE actors ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE actors ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE actors ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE actors ADD COLUMN IF NOT EXISTS group_id UUID;
ALTER TABLE actors ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE actors ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE actors ADD COLUMN IF NOT EXISTS bio TEXT;

ALTER TABLE actors ADD COLUMN IF NOT EXISTS metadata JSONB;
UPDATE actors SET metadata = '{}'::jsonb WHERE metadata IS NULL;
ALTER TABLE actors ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;
ALTER TABLE actors ALTER COLUMN metadata SET NOT NULL;

-- actor_id: mesmo UUID que id (contrato social usa actor_id; PK permanece id)
ALTER TABLE actors ADD COLUMN IF NOT EXISTS actor_id UUID;
UPDATE actors SET actor_id = id WHERE actor_id IS NULL;
ALTER TABLE actors ALTER COLUMN actor_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_actors_actor_id ON actors (actor_id);

-- ---------------------------------------------------------------------------
-- 3) FK opcional para users (SET NULL: actors de sistema / empresa sem user)
-- ---------------------------------------------------------------------------
ALTER TABLE actors DROP CONSTRAINT IF EXISTS actors_user_id_fkey;
ALTER TABLE actors
  ADD CONSTRAINT actors_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_actors_user_id ON actors (user_id) WHERE user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4) Backfill user_id a partir de users (global_user_id + tenant)
-- ---------------------------------------------------------------------------
UPDATE actors a
SET user_id = u.id
FROM users u
WHERE a.user_id IS NULL
  AND a.tenant_id = u.tenant_id
  AND a.global_user_id IS NOT NULL
  AND u.global_user_id = a.global_user_id;

-- ---------------------------------------------------------------------------
-- 5) Novos INSERTs: garantir actor_id = id quando não informado
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION actors_sync_actor_id_from_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF NEW.actor_id IS NULL THEN
    NEW.actor_id := NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_actors_sync_actor_id ON actors;
CREATE TRIGGER trg_actors_sync_actor_id
  BEFORE INSERT ON actors
  FOR EACH ROW
  EXECUTE FUNCTION actors_sync_actor_id_from_id();

COMMIT;
