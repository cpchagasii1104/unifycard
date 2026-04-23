BEGIN;

-- C52 Passo 1a: renomear coluna status → payment_status (07_NOMENCLATURA_CANONICA §4.1)
-- status isolado é proibido em domínio financeiro
ALTER TABLE payment_intents
  RENAME COLUMN status TO payment_status;

ALTER TABLE payment_intents
  RENAME CONSTRAINT payment_intents_status_check TO payment_intents_payment_status_check;

COMMIT;
