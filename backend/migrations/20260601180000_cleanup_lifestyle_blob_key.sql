-- ============================================================
-- F5 (DECISION-0071) — Cleanup do blob Lifestyle: remove `global_users.metadata.lifestyle`
-- ============================================================
-- Lifestyle (drinks/smokes/relationshipStatus) já migrou para o SSOT actor-first `actor_lifestyle_attributes`
-- (F1b schema, F2 service, F3 rotas/frontend, F4 readers/core). `sexualOrientation` ficou FORA do MVP. A
-- chave legada `global_users.metadata.lifestyle` é dívida transitória — esta migration a remove.
--
-- Forward-only, idempotente (re-run afeta 0 linhas). Remove SOMENTE a chave `lifestyle` — PRESERVA todo o
-- resto: `preferences`, `physicalMetadata` (e `sharedHealthData` dentro dele), `updatedAt`, `learningPreferences`,
-- e quaisquer outras chaves não-alvo. NÃO insere em `actor_lifestyle_attributes` (sem backfill); valores
-- legados sem consentimento NÃO viram ativos+consentidos (DECISION-0071 §6 — usuário re-declara com consent).
-- NÃO cria actor. NÃO toca Saúde (Health segue 501; tabelas de saúde ausentes). Estado DEV: 2 global_users com
-- a chave, ambos com valores nulos → remoção da chave sem perda de dado real.
-- ============================================================

BEGIN;

-- Remove APENAS a chave `lifestyle`; só toca linhas que a possuem (idempotente).
UPDATE global_users
SET metadata = metadata - 'lifestyle',
    updated_at = now()
WHERE metadata ? 'lifestyle';

-- VERIFICAÇÃO PÓS: nenhuma linha pode reter a chave removida.
DO $$
DECLARE
  v_left INTEGER;
BEGIN
  SELECT count(*) INTO v_left FROM global_users WHERE metadata ? 'lifestyle';
  IF v_left <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: % global_users ainda com lifestyle no metadata apos cleanup', v_left;
  END IF;
END $$;

COMMIT;
