-- ============================================================
-- C2 Rollout Passo 1 — Adicionar concept_id em bank_transactions
-- ============================================================
-- Remete a: docs/02_decisions/RFC_C2_rollout.md (commit 706b61af)
-- Estratégia: NULL-first. SET NOT NULL em migration futura (Passo 6).
-- Forward-only. Rollback manual (não há DROP automático de coluna).
-- ============================================================

BEGIN;

-- Idempotência: só adiciona se não existe ainda
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bank_transactions'
      AND column_name = 'concept_id'
  ) THEN
    ALTER TABLE bank_transactions
      ADD COLUMN concept_id UUID NULL
        REFERENCES concepts(concept_id)
        ON DELETE RESTRICT;
  END IF;
END $$;

-- Índice para queries por concept (agregações, relatórios)
CREATE INDEX IF NOT EXISTS idx_bank_transactions_concept_id
  ON bank_transactions (concept_id);

COMMIT;
