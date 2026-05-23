-- ============================================================
-- MIGRATION: 20260517100000_authority_roots_integrity.sql
-- B4: FK authority_roots → actors (integridade referencial)
-- B5: enforcement actor humano sem authority_roots (DECISÃO PENDENTE)
-- Ref: docs/ssot/AUTHORITY_PRECEDENCE.md §4.1, docs/01_normative/SSOT_REGISTRY_UNIFICARD.md §authority_roots
-- ============================================================

BEGIN;

-- ── B4: Diagnóstico de órfãos ─────────────────────────────────────────────
DO $$
DECLARE orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM authority_roots ar
  WHERE NOT EXISTS (SELECT 1 FROM actors a WHERE a.id = ar.actor_id);
  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'authority_roots tem % linhas órfãs sem actor. '
      'Limpar antes de prosseguir: '
      'DELETE FROM authority_roots ar WHERE NOT EXISTS (SELECT 1 FROM actors a WHERE a.id = ar.actor_id);',
      orphan_count;
  END IF;
  RAISE NOTICE 'Sem órfãos — FK pode ser aplicada.';
END $$;

-- ── B4: FK authority_roots → actors ───────────────────────────────────────
ALTER TABLE authority_roots
  ADD CONSTRAINT fk_authority_roots_actor
  FOREIGN KEY (actor_id)
  REFERENCES actors(id)
  ON DELETE RESTRICT;

COMMENT ON CONSTRAINT fk_authority_roots_actor ON authority_roots IS
  'Garante raiz de autoridade sempre aponta para actor existente. '
  'ON DELETE RESTRICT: actor com authority_root não pode ser removido. '
  'Migration: 20260517100000.';

-- ── B5: OPÇÃO A — enforcement (descomentar após decisão de Clayton) ────────
-- Actors humanos exigem authority_roots antes de serem criados.
-- Verificar primeiro: SELECT COUNT(*) FROM actors WHERE actor_type IN
-- (''user'',''actor_human'',''person'') AND NOT EXISTS
-- (SELECT 1 FROM authority_roots WHERE actor_id = actors.id);
-- Se = 0: Opção A é segura. Se > 0: usar Opção B primeiro.

-- CREATE OR REPLACE FUNCTION trg_authority_roots_required_for_human()
-- RETURNS TRIGGER LANGUAGE plpgsql
-- SET search_path = pg_catalog, public, pg_temp AS $$
-- BEGIN
--   IF NEW.actor_type IN ('user', 'actor_human', 'person') THEN
--     IF NOT EXISTS (SELECT 1 FROM authority_roots WHERE actor_id = NEW.id) THEN
--       RAISE EXCEPTION
--         'Actor humano (id=%, tipo=%) exige authority_roots. '
--         'Ref: docs/ssot/AUTHORITY_PRECEDENCE.md §4.1', NEW.id, NEW.actor_type;
--     END IF;
--   END IF;
--   RETURN NEW;
-- END; $$;
-- DROP TRIGGER IF EXISTS trg_actors_authority_roots_required ON actors;
-- CREATE TRIGGER trg_actors_authority_roots_required
--   AFTER INSERT OR UPDATE OF actor_type ON actors
--   FOR EACH ROW EXECUTE FUNCTION trg_authority_roots_required_for_human();

-- ── B5: OPÇÃO B — warning (período de transição) ──────────────────────────
-- CREATE OR REPLACE FUNCTION trg_authority_roots_warn_for_human()
-- RETURNS TRIGGER LANGUAGE plpgsql
-- SET search_path = pg_catalog, public, pg_temp AS $$
-- BEGIN
--   IF NEW.actor_type IN ('user', 'actor_human', 'person') THEN
--     IF NOT EXISTS (SELECT 1 FROM authority_roots WHERE actor_id = NEW.id) THEN
--       RAISE WARNING
--         'Actor humano (id=%, tipo=%) sem authority_roots. '
--         'Ref: docs/ssot/AUTHORITY_PRECEDENCE.md §4.1', NEW.id, NEW.actor_type;
--     END IF;
--   END IF;
--   RETURN NEW;
-- END; $$;
-- DROP TRIGGER IF EXISTS trg_actors_authority_roots_warn ON actors;
-- CREATE TRIGGER trg_actors_authority_roots_warn
--   AFTER INSERT OR UPDATE OF actor_type ON actors
--   FOR EACH ROW EXECUTE FUNCTION trg_authority_roots_warn_for_human();

COMMIT;

-- ============================================================
-- ROLLBACK:
-- BEGIN;
-- ALTER TABLE authority_roots DROP CONSTRAINT IF EXISTS fk_authority_roots_actor;
-- DROP TRIGGER IF EXISTS trg_actors_authority_roots_required ON actors;
-- DROP FUNCTION IF EXISTS trg_authority_roots_required_for_human();
-- DROP TRIGGER IF EXISTS trg_actors_authority_roots_warn ON actors;
-- DROP FUNCTION IF EXISTS trg_authority_roots_warn_for_human();
-- COMMIT;
-- ============================================================

-- ── Verificação (executar após aplicar): ──────────────────────────────────
-- SELECT constraint_name FROM information_schema.table_constraints
-- WHERE table_name = 'authority_roots' AND constraint_name = 'fk_authority_roots_actor';
--
-- SELECT COUNT(*) FROM actors a WHERE a.actor_type IN ('user','actor_human','person')
--   AND NOT EXISTS (SELECT 1 FROM authority_roots ar WHERE ar.actor_id = a.id);
-- (Se > 0: usar Opção B para B5 até backfill. Se = 0: Opção A é segura.)
