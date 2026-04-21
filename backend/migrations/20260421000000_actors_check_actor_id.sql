-- Migration: actors CHECK constraint actor_id = id
-- C26: garantir que actor_id nunca divirja de id
-- Pré-condição: migration 0064 já fez UPDATE SET actor_id = id + trigger de sync

BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'actors'
      AND constraint_name = 'chk_actors_actor_id_equals_id'
  ) THEN
    ALTER TABLE actors
      ADD CONSTRAINT chk_actors_actor_id_equals_id
      CHECK (actor_id = id);
  END IF;
END $$;

COMMIT;
