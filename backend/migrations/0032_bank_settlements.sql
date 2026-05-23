-- 0032_bank_settlements.sql
-- Bank settlements: envio ao banco/PSP (seller_payout → bank_settlement).

CREATE TABLE bank_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  payout_id UUID NOT NULL,
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_bank_settlements_tenant_status
  ON bank_settlements (tenant_id, status);

CREATE INDEX idx_bank_settlements_created
  ON bank_settlements (created_at ASC);

COMMENT ON TABLE bank_settlements IS 'Envios ao banco/PSP (seller_payout → bank_settlement); processados pelo Bank Settlement Worker.';
