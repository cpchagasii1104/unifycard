-- 20260623120000_bank_splits_append_only.sql
-- SPLIT-01 — bank_splits append-only: bloqueia UPDATE e DELETE em bank_splits (simetria com bank_ledger, 0021).
-- O runtime vivo só faz INSERT (bankSplitRepository.createSplit); correções via transação de adjustment/reversal
-- (insere nova linha), NUNCA alterando/apagando linhas existentes. Nota fiscal do cofre não é editável.
-- Idempotente (DROP TRIGGER IF EXISTS + CREATE OR REPLACE FUNCTION). Não toca dados, schema de colunas, nem dinheiro.

CREATE OR REPLACE FUNCTION prevent_bank_splits_modification()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'bank_splits is append-only. UPDATE or DELETE is not allowed.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bank_splits_no_update ON bank_splits;
CREATE TRIGGER bank_splits_no_update
  BEFORE UPDATE ON bank_splits
  FOR EACH ROW
  EXECUTE FUNCTION prevent_bank_splits_modification();

DROP TRIGGER IF EXISTS bank_splits_no_delete ON bank_splits;
CREATE TRIGGER bank_splits_no_delete
  BEFORE DELETE ON bank_splits
  FOR EACH ROW
  EXECUTE FUNCTION prevent_bank_splits_modification();
