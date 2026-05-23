-- 0022_split_invariant.sql
-- Split inflation guard: soma dos splits não pode superar o valor da transação.
-- Regra: SUM(bank_splits.amount_cents) <= bank_transactions.amount_cents por transaction_id.

CREATE OR REPLACE FUNCTION validate_split_total()
RETURNS trigger AS $$
DECLARE
  split_sum BIGINT;
  tx_amount BIGINT;
  effective_sum BIGINT;
BEGIN
  SELECT amount_cents INTO tx_amount
  FROM bank_transactions
  WHERE id = NEW.transaction_id;

  IF tx_amount IS NULL THEN
    RAISE EXCEPTION 'Transaction not found for split: %', NEW.transaction_id;
  END IF;

  SELECT COALESCE(SUM(amount_cents), 0) INTO split_sum
  FROM bank_splits
  WHERE transaction_id = NEW.transaction_id;

  IF TG_OP = 'INSERT' THEN
    effective_sum := split_sum + NEW.amount_cents;
  ELSIF TG_OP = 'UPDATE' THEN
    effective_sum := split_sum - OLD.amount_cents + NEW.amount_cents;
  ELSE
    effective_sum := split_sum;
  END IF;

  IF effective_sum > tx_amount THEN
    RAISE EXCEPTION 'Split inflation detected: splits exceed transaction amount (transaction: %, limit: %, effective sum: %)',
      NEW.transaction_id, tx_amount, effective_sum;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bank_splits_validate_total ON bank_splits;
CREATE TRIGGER bank_splits_validate_total
  BEFORE INSERT OR UPDATE ON bank_splits
  FOR EACH ROW
  EXECUTE FUNCTION validate_split_total();
