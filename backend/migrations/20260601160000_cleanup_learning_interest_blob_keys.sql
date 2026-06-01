-- ============================================================
-- C1 — Cleanup do blob Learning/Interest (Fatia 5, DECISION-0067)
-- ============================================================
-- Remove as chaves legadas `learnings` e `interests` de `global_users.metadata`. Learning e Interest já
-- foram migrados e provados em C1 actor-first (`actor_learning_concepts` / `actor_interest_concepts`); o
-- backfill blob→C1 (20260601150000) já rodou (no-op seguro em DEV). Estas chaves são dívida transitória.
--
-- Forward-only, idempotente (re-run afeta 0 linhas). Remove SOMENTE as duas chaves — preserva TODO o resto
-- de `metadata` (lifestyle, preferences, learningPreferences, learningMetadata, physicalMetadata, updatedAt…).
--
-- NÃO toca: substrato C1 (não insere — backfill já rodou) · lifestyle/saúde sensível (DT-LIFESTYLE-SENSITIVE-
-- IN-BLOB, frente própria) · actors · categories/concepts · bank_*/split/payout/ledger. NÃO cria actor.
-- Estado DEV 2026-06-01: 2 global_users com as chaves (ambas como array vazio `[]`, resíduo de writes legados)
-- → cleanup remove as chaves sem perda de dado real.
-- ============================================================

BEGIN;

-- GUARD: a verdade semântica deve já existir em C1 antes de limpar o blob (anti-perda).
DO $$
BEGIN
  IF to_regclass('public.actor_learning_concepts') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: actor_learning_concepts ausente (C1 deve existir antes do cleanup do blob)';
  END IF;
  IF to_regclass('public.actor_interest_concepts') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: actor_interest_concepts ausente (C1 deve existir antes do cleanup do blob)';
  END IF;
END $$;

-- Remove APENAS as chaves `learnings` e `interests`; só toca linhas que as possuem (idempotente).
UPDATE global_users
SET metadata = metadata - 'learnings' - 'interests',
    updated_at = now()
WHERE metadata ? 'learnings' OR metadata ? 'interests';

-- VERIFICAÇÃO PÓS: nenhuma linha pode reter as chaves removidas.
DO $$
DECLARE
  v_left INTEGER;
BEGIN
  SELECT count(*) INTO v_left
    FROM global_users
   WHERE metadata ? 'learnings' OR metadata ? 'interests';
  IF v_left <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: % global_users ainda com learnings/interests no metadata apos cleanup', v_left;
  END IF;
END $$;

COMMIT;
