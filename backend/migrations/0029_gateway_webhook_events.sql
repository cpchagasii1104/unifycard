-- 0029_gateway_webhook_events.sql
-- Webhook Idempotency Guard: evita processar o mesmo webhook duas vezes (PIX, Stripe, etc.).

CREATE TABLE gateway_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX uq_gateway_webhook_events_provider_reference
  ON gateway_webhook_events (provider, reference_id);

COMMENT ON TABLE gateway_webhook_events IS 'Registro de webhooks já recebidos para idempotência; não altera core financeiro.';
