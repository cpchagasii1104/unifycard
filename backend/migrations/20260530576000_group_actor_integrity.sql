-- ============================================================
-- Group-Actor — integridade (Fase 3C.3, Etapa 1)
-- Desenho: docs/02_decisions/DESENHO_FASE_3C_GROUP_ACTOR_DOIS_MOMENTOS.md (commit 962987b1)
--
-- SCHEMA-ONLY (integridade). Prepara o substrato para o group-actor (actor_type='group'):
--   1. unique partial index uq_actors_group — no máximo 1 page... 1 group-actor por group
--   2. FK actors.group_id → groups(id) ON DELETE RESTRICT (D1 ratificada)
--   3. unique partial index uq_groups_actor — 1:1 group↔actor (D2 ratificada)
--
-- Decisões ratificadas: D1 RESTRICT (app só faz soft-delete de groups → política não dispara
--   no caminho real; protege rastro institucional + group_accounts/ledger). D2 unique groups.actor_id.
-- ADIADO (NÃO nesta migration): D3 CHECK group_members.role · D4 groups.owner_actor_id NOT NULL.
-- NÃO toca: src/, resolver, CONCEPT, bank, authz, constraint actor_type (drift D1 permanece).
--
-- Pré-requisitos: actors (0010, com group_id + actor_type), groups (com id + actor_id).
-- Reversibilidade: DROP INDEX + DROP CONSTRAINT — additive only.
-- Blast: BAIXO — guards abortam se houver órfão/duplicata; DEV limpo (0 rows).
-- ============================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- GUARD a — órfãos: actor.group_id apontando para group inexistente (antes da FK)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM actors a
  LEFT JOIN groups g ON g.id = a.group_id
  WHERE a.group_id IS NOT NULL AND g.id IS NULL;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'MIGRATION ABORTADA: % actor(es) com group_id órfão (group inexistente). '
      'Resolver manualmente antes de aplicar a FK.', orphan_count;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- GUARD b — duplicatas de group-actor (antes de uq_actors_group)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT group_id, COUNT(*) AS n
      FROM actors
     WHERE actor_type = 'group' AND group_id IS NOT NULL
     GROUP BY group_id
    HAVING COUNT(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'MIGRATION ABORTADA: % group(s) com múltiplos group-actors. '
      'Resolver manualmente antes do unique index.', dup_count;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- GUARD c — duplicatas de groups.actor_id (antes de uq_groups_actor)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT actor_id, COUNT(*) AS n
      FROM groups
     WHERE actor_id IS NOT NULL
     GROUP BY actor_id
    HAVING COUNT(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'MIGRATION ABORTADA: % actor_id repetido em groups. '
      'Resolver manualmente antes do unique index.', dup_count;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. unique partial index: no máximo 1 group-actor por group
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_actors_group
  ON actors (group_id)
  WHERE actor_type = 'group' AND group_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. FK actors.group_id → groups(id) ON DELETE RESTRICT (D1)
--    ADD CONSTRAINT não aceita IF NOT EXISTS → guard via pg_constraint.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'actors'::regclass
       AND conname = 'actors_group_id_fkey'
  ) THEN
    ALTER TABLE actors
      ADD CONSTRAINT actors_group_id_fkey
      FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. unique partial index: 1:1 group↔actor (D2)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_groups_actor
  ON groups (actor_id)
  WHERE actor_id IS NOT NULL;

COMMENT ON INDEX uq_actors_group IS
  'Garante no máximo 1 group-actor por group (Fase 3C.3). Cobre actor_type=group com group_id NOT NULL.';
COMMENT ON INDEX uq_groups_actor IS
  'Garante 1:1 group↔actor (Fase 3C.3). Cobre groups com actor_id NOT NULL.';
COMMENT ON CONSTRAINT actors_group_id_fkey ON actors IS
  'group-actor referencia groups(id); ON DELETE RESTRICT preserva rastro institucional (Fase 3C.3, D1).';

COMMIT;
