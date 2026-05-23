-- 0021_ledger_append_only.sql
-- Ledger append-only: bloqueia UPDATE e DELETE em bank_ledger.
-- Correções devem ser feitas via transação de adjustment, nunca alterando linhas existentes.

CREATE OR REPLACE FUNCTION prevent_bank_ledger_modification()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'bank_ledger is append-only. UPDATE or DELETE is not allowed.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bank_ledger_no_update ON bank_ledger;
CREATE TRIGGER bank_ledger_no_update
  BEFORE UPDATE ON bank_ledger
  FOR EACH ROW
  EXECUTE FUNCTION prevent_bank_ledger_modification();

DROP TRIGGER IF EXISTS bank_ledger_no_delete ON bank_ledger;
CREATE TRIGGER bank_ledger_no_delete
  BEFORE DELETE ON bank_ledger
  FOR EACH ROW
  EXECUTE FUNCTION prevent_bank_ledger_modification();
