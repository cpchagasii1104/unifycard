-- ============================================================
-- GENESIS 0004: MARKETPLACE
-- ============================================================
-- Domínio: payments, orders, intents (pré-financeiro)
-- MODO: Constitucional Rígido

BEGIN;

-- Payment Intents (pré-financeiro, NÃO decide dinheiro)
CREATE TABLE payment_intents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID NOT NULL REFERENCES actors(id),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  intent_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_intents_tenant ON payment_intents(tenant_id);
CREATE INDEX idx_payment_intents_actor ON payment_intents(actor_id);
CREATE INDEX idx_payment_intents_status ON payment_intents(status);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  buyer_actor_id UUID NOT NULL REFERENCES actors(id),
  seller_actor_id UUID NOT NULL REFERENCES actors(id),
  total_cents BIGINT NOT NULL CHECK (total_cents > 0),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_orders_buyer ON orders(buyer_actor_id);
CREATE INDEX idx_orders_seller ON orders(seller_actor_id);

-- UnifyCard Transactions (log operacional, NÃO decide saldo)
CREATE TABLE unifycard_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID NOT NULL REFERENCES actors(id),
  bank_transaction_id UUID REFERENCES bank_transactions(id),
  external_id TEXT,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('capture', 'authorization', 'settlement', 'void')),
  amount_cents BIGINT NOT NULL,
  status TEXT NOT NULL,
  external_partner TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_unifycard_tenant ON unifycard_transactions(tenant_id);
CREATE INDEX idx_unifycard_bank_tx ON unifycard_transactions(bank_transaction_id);

COMMIT;

