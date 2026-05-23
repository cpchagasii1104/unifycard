-- Pagamento de pedidos de descoberta de serviços (accepted → bank transfer)
BEGIN;

ALTER TABLE service_discovery_requests
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(16) NULL
    CHECK (payment_status IS NULL OR payment_status IN ('pending', 'paid')),
  ADD COLUMN IF NOT EXISTS payment_bank_transaction_id UUID NULL,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN service_discovery_requests.payment_status IS
  'NULL = não pago; pending = pagamento em curso; paid = concluído';
COMMENT ON COLUMN service_discovery_requests.payment_bank_transaction_id IS
  'id em bank_transactions após pagamento bem-sucedido';

COMMIT;
