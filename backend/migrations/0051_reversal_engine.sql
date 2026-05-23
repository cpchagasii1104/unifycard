-- Prompt 51 — Reversal Engine (refund / cancelamento financeiro)
-- Registro formal de reversões; dinheiro via nova transação (bankTransactionService), sem alterar ledger histórico.

BEGIN;

CREATE TABLE reversals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  original_transaction_id UUID NOT NULL REFERENCES bank_transactions(id) ON DELETE RESTRICT,
  reversal_transaction_id UUID REFERENCES bank_transactions(id) ON DELETE RESTRICT,
  actor_id UUID NOT NULL REFERENCES actors(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'executed', 'failed')),
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_reversals_original_transaction_id ON reversals (original_transaction_id);

CREATE INDEX idx_reversals_tenant_status ON reversals (tenant_id, status);
CREATE INDEX idx_reversals_created ON reversals (created_at);

COMMENT ON TABLE reversals IS 'Prompt 51: solicitações de reversão financeira; execução cria nova bank_transaction (espelhada), sem reescrever bank_ledger existente.';

COMMIT;
