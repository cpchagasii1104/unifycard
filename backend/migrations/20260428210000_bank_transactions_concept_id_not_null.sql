BEGIN;
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'bank_transactions'
      AND column_name  = 'concept_id'
      AND is_nullable  = 'YES'
  ) THEN
    ALTER TABLE bank_transactions
      ALTER COLUMN concept_id SET NOT NULL;
  END IF;
END $$;
COMMENT ON COLUMN bank_transactions.concept_id IS 'FK obrigatória para concepts(concept_id). SSOT semântico da operação financeira. C2 Rollout Passo 6 — SET NOT NULL aplicado em 20260428210000. §4.10.6 LEI_DE_COERENCIA_SISTEMICA.';
COMMIT;
