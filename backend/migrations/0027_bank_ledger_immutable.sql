-- 0027_bank_ledger_immutable.sql
-- Garante que bank_ledger é append-only (UPDATE/DELETE rejeitados).
-- Idempotente: recria triggers se 0021 não tiver sido aplicado ou falhou.

CREATE OR REPLACE FUNCTION prevent_bank_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'bank_ledger is append-only. UPDATE or DELETE is not allowed.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bank_ledger_no_update ON bank_ledger;
CREATE TRIGGER bank_ledger_no_update
  BEFORE UPDATE ON bank_ledger
  FOR EACH ROW
  EXECUTE PROCEDURE prevent_bank_ledger_modification();

DROP TRIGGER IF EXISTS bank_ledger_no_delete ON bank_ledger;
CREATE TRIGGER bank_ledger_no_delete
  BEFORE DELETE ON bank_ledger
  FOR EACH ROW
  EXECUTE PROCEDURE prevent_bank_ledger_modification();
