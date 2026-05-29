-- F-MIGRATION-REBUILD-PACKAGES Pacote 1.c
-- Repair: criar bank_transactions_concept_id_fkey órfã pelo padrão do Pacote 1.b.
--
-- Causa: 20260428205000_repair_bank_transactions_concept_id.sql (Pacote 1.b) cria
-- bank_transactions.concept_id nua antes da 20260530506000. Quando 506000 roda,
-- seu DO $$ IF NOT EXISTS THEN ADD COLUMN ... REFERENCES concepts(concept_id) ON
-- DELETE RESTRICT skip → a FK que estava DENTRO do bloco fica órfã no rebuild.
-- (O índice idx_bank_transactions_concept_id da 506000 está FORA do DO $$, então
--  não fica órfão — confirmado pelo DIFF-AUDIT: indexes 840=840.)
--
-- Esta migration cria SÓ a FK, guarded por NOT EXISTS pg_constraint.
-- Banco vivo: FK já existe → IF NOT EXISTS=FALSE → no-op.
-- Rebuild zero: coluna+índice já existem (Pacote 1.b cria coluna; 506000 cria
-- índice); FK criada aqui → diff Grupo 3 fecha em 0.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'bank_transactions'::regclass
      AND conname  = 'bank_transactions_concept_id_fkey'
      AND contype  = 'f'
  ) THEN
    ALTER TABLE bank_transactions
      ADD CONSTRAINT bank_transactions_concept_id_fkey
      FOREIGN KEY (concept_id)
      REFERENCES concepts(concept_id)
      ON DELETE RESTRICT;
  END IF;
END $$;
