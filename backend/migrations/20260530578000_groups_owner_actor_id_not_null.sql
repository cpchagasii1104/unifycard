-- ============================================================
-- COE-2: groups.owner_actor_id NOT NULL (ancora civil obrigatoria)
-- Desenho: raio-X pos-Fase 3C (COE-2) + relatorio READ-ONLY 2026-05-30
--
-- A coluna ja e obrigatoria de-facto: createGroup sempre seta owner_actor_id
-- (ensureUserActor lanca antes), e ensureGroupActor exige owner_actor_id com
-- dois throws (§4.8.2) e o usa como responsible_actor_id do group-actor.
-- Esta migration formaliza a regra no banco (2a linha de defesa, como SEC-1).
--
-- NAO toca: FK groups_owner_actor_id_fkey (ON DELETE — DT separada),
--           groups.actor_id (NULL legitimo por dois momentos).
-- Pre-flight: zero grupos com owner_actor_id NULL (DEV vazio). Sem backfill.
-- Reversibilidade: hardening forward-only; rollback tecnico = DROP NOT NULL.
-- Blast: baixo — zero linhas afetadas, sem backfill, sem correcao de codigo.
-- ============================================================

BEGIN;

-- GUARD pre-voo: zero grupos sem owner_actor_id
DO $$
DECLARE
  violation_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO violation_count
  FROM groups
  WHERE owner_actor_id IS NULL;

  IF violation_count > 0 THEN
    RAISE EXCEPTION
      'MIGRATION ABORTADA: % grupo(s) sem owner_actor_id. Backfill obrigatorio '
      'antes de aplicar NOT NULL (ancora civil do grupo, §4.8.2).', violation_count;
  END IF;
END $$;

ALTER TABLE groups ALTER COLUMN owner_actor_id SET NOT NULL;

COMMIT;
