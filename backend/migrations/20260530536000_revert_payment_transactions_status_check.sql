-- Reverte CHECK em payment_transactions.status (C36 reconciliação)
--
-- O CHECK adicionado em 20260530535000 cristalizou UPPERCASE ('PENDING','SUCCESS','FAILED')
-- sem DECISION arquitetural. payment_intents também tem drift de casing inconsistente
-- com o domínio bank_* (que usa lowercase). Adiado até DT-PAYMENT-CASING-DRIFT
-- ser resolvido via DECISION dedicada.
--
-- Referências: DT-PAYMENT-CASING-DRIFT (REMEDIATION_DT_LOG.md)

BEGIN;

ALTER TABLE payment_transactions
  DROP CONSTRAINT IF EXISTS chk_payment_transactions_status;

INSERT INTO schema_migrations (filename) VALUES ('20260530536000_revert_payment_transactions_status_check.sql')
  ON CONFLICT DO NOTHING;

COMMIT;
