-- Prompt 51.1 — Reversal Engine Hardening
-- counterpart_account_id: SSOT operacional para transfer simples (não depender do ledger para roteamento)
-- reversal_transaction_ids: múltiplas transações em reversão composta (split)

BEGIN;

ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS counterpart_account_id UUID REFERENCES bank_accounts(id);

COMMENT ON COLUMN bank_transactions.counterpart_account_id IS 'Prompt 51.1: conta creditada na transferência simples; preenchido em novas transferências.';

ALTER TABLE reversals
  ADD COLUMN IF NOT EXISTS reversal_transaction_ids UUID[];

COMMENT ON COLUMN reversals.reversal_transaction_ids IS 'Prompt 51.1: todas as bank_transactions da reversão (simples ou split); reversal_transaction_id mantém a primeira para compat.';

CREATE INDEX IF NOT EXISTS idx_bank_transactions_counterpart
  ON bank_transactions (tenant_id, counterpart_account_id)
  WHERE counterpart_account_id IS NOT NULL;

COMMIT;
