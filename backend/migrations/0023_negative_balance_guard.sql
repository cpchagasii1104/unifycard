-- 0023_negative_balance_guard.sql
-- Impede saldo negativo em contas críticas: user_wallet, seller_available, escrow_payments.
-- Proteção no banco, mesmo se o código falhar na validação.

CREATE OR REPLACE FUNCTION validate_non_negative_balance()
RETURNS trigger AS $$
DECLARE
  acc_type TEXT;
  current_balance BIGINT;
  new_balance BIGINT;
BEGIN
  SELECT account_type
  INTO acc_type
  FROM bank_accounts
  WHERE id = NEW.account_id;

  IF acc_type IS NULL THEN
    RETURN NEW;
  END IF;

  IF acc_type NOT IN ('user_wallet', 'seller_available', 'escrow_payments') THEN
    RETURN NEW;
  END IF;

  IF NEW.direction = 'credit' THEN
    RETURN NEW;
  END IF;

  -- direction = 'debit': saldo após esta linha = saldo_atual - NEW.amount_cents
  SELECT COALESCE(SUM(
    CASE
      WHEN direction = 'credit' THEN amount_cents
      ELSE -amount_cents
    END
  ), 0)
  INTO current_balance
  FROM bank_ledger
  WHERE account_id = NEW.account_id;

  new_balance := current_balance - NEW.amount_cents;

  IF new_balance < 0 THEN
    RAISE EXCEPTION 'Negative balance not allowed for account type % (account_id: %, current: %, debit: %, would be: %)',
      acc_type, NEW.account_id, current_balance, NEW.amount_cents, new_balance;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bank_ledger_non_negative_balance ON bank_ledger;
CREATE TRIGGER bank_ledger_non_negative_balance
  BEFORE INSERT ON bank_ledger
  FOR EACH ROW
  EXECUTE FUNCTION validate_non_negative_balance();
