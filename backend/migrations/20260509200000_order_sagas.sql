BEGIN;

CREATE TABLE IF NOT EXISTS order_sagas (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id   UUID NOT NULL,
  state      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata   JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT order_sagas_tenant_order_uk UNIQUE (tenant_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_order_sagas_tenant_state
  ON order_sagas (tenant_id, state, updated_at DESC);

COMMENT ON TABLE order_sagas IS
  'Estado explícito da saga pedido/pagamento/estoque. '
  'Transições idempotentes; compensação em falha de pagamento.';

COMMIT;
