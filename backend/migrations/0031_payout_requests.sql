-- 0031_payout_requests.sql
-- Payout requests: sellers sacando fundos (seller_available → seller_payout).

CREATE TABLE payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_payout_requests_tenant_status
  ON payout_requests (tenant_id, status);

CREATE INDEX idx_payout_requests_created
  ON payout_requests (created_at ASC);

COMMENT ON TABLE payout_requests IS 'Solicitações de saque (seller_available → seller_payout); processadas pelo Payout Worker.';
