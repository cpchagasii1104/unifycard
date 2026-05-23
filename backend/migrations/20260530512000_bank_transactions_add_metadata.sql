BEGIN;

-- Adiciona coluna metadata em bank_transactions
-- Prevista em CreateBankTransactionInput mas ausente no schema original.
-- DEFAULT '{}' garante compatibilidade com registros existentes (forward-only safe).
-- Usada em getDailyOutflow (bank-limit.service) para filtrar por contexto de transação.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bank_transactions'
      AND column_name = 'metadata'
  ) THEN
    ALTER TABLE bank_transactions
      ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bank_transactions_metadata
  ON bank_transactions USING GIN (metadata);

COMMIT;
