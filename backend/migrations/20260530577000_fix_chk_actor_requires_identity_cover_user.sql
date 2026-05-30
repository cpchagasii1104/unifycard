-- ============================================================
-- SEC-1: chk_actor_requires_identity cobre tipos humanos canônicos
-- Desenho: raio-X pós-Fase 3C (SEC-1) + relatório READ-ONLY 2026-05-30
--
-- Gap: 0010 criou a constraint para o mundo 'actor_human'. 0064 reabriu
-- actor_type para incluir 'user' (canônico runtime) sem atualizar esta
-- constraint. Banco aceitava actor humano sem global_user_id.
--
-- Esta migration amplia a cobertura para user/actor_human/person.
-- Runtime já é fail-closed (findOrCreateUserActor); isto é a 2ª linha no banco.
--
-- NÃO toca: actors_actor_type_check (SEC-2), responsible_actor_id (§4.8),
--           page/group/channel (âncora civil via responsible_actor_id).
-- Pré-requisitos: 0010 (constraint original), 0064 (reabertura de vocabulário).
-- Reversibilidade: hardening forward-only; rollback técnico restaura cobertura
--                  antiga apenas para actor_human.
-- Blast: baixo — pré-flight zero violações, aplica sem backfill.
-- ============================================================

BEGIN;

-- GUARD pré-voo: zero actors humanos sem global_user_id
DO $$
DECLARE
  violation_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO violation_count
  FROM actors
  WHERE actor_type IN ('user', 'actor_human', 'person')
    AND global_user_id IS NULL;

  IF violation_count > 0 THEN
    RAISE EXCEPTION
      'MIGRATION ABORTADA: % actor(es) tipo user/actor_human/person sem '
      'global_user_id. Resolver antes de aplicar chk_actor_requires_identity ampliada.',
      violation_count;
  END IF;
END $$;

-- DROP + ADD com cobertura ampliada
ALTER TABLE actors DROP CONSTRAINT chk_actor_requires_identity;

ALTER TABLE actors
  ADD CONSTRAINT chk_actor_requires_identity
  CHECK (
    actor_type NOT IN ('user', 'actor_human', 'person')
    OR global_user_id IS NOT NULL
  );

-- GATE pós-aplicação (re-verifica dentro da mesma TX)
DO $$
DECLARE
  violation_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO violation_count
  FROM actors
  WHERE actor_type IN ('user', 'actor_human', 'person')
    AND global_user_id IS NULL;

  IF violation_count > 0 THEN
    RAISE EXCEPTION
      'GATE PÓS-APLICAÇÃO FALHOU: % violação(ões) após aplicar a constraint.',
      violation_count;
  END IF;
END $$;

COMMIT;
