-- 0025_reference_idempotency.sql
-- Idempotência por evento externo: evita duplicar settlement/payout quando webhook ou job repete.
-- UNIQUE(tenant_id, reference_type, reference_id) quando preenchidos.

-- Garante colunas (podem já existir em 0003)
ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS reference_type TEXT;

ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS reference_id TEXT;

-- Índice único parcial: só aplica quando reference está preenchido
CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_transactions_reference
  ON bank_transactions (tenant_id, reference_type, reference_id)
  WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL;

COMMENT ON COLUMN bank_transactions.reference_type IS 'Tipo do evento externo (ex: settlement, payout_request, bank_payout, dispute_release) para idempotência';
COMMENT ON COLUMN bank_transactions.reference_id IS 'ID do evento externo (paymentIntentId, payoutRequestId, bankTransferId) para idempotência';
