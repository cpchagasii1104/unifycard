-- ================================================
-- UNIFICARD - MIGRATION 076
-- Organizer Subscriptions (FASE 10A)
-- Sistema de assinaturas para organizadores
-- ================================================

-- Tabela de assinaturas
CREATE TABLE IF NOT EXISTS organizer_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES event_organizers(id) ON DELETE CASCADE,
  
  -- Plano
  plan VARCHAR(20) NOT NULL CHECK (plan IN ('free', 'basic', 'pro', 'enterprise')),
  
  -- Billing
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired', 'past_due')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL,
  
  -- Gateway de pagamento (genérico, pode ser Stripe, Pagar.me, etc.)
  payment_gateway TEXT, -- 'stripe', 'pagarme', etc.
  payment_gateway_subscription_id TEXT, -- ID da assinatura no gateway
  payment_gateway_customer_id TEXT, -- ID do cliente no gateway
  
  -- Metadados
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  canceled_at TIMESTAMPTZ NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_subscriptions_organizer ON organizer_subscriptions (organizer_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON organizer_subscriptions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON organizer_subscriptions (current_period_end) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_subscriptions_gateway ON organizer_subscriptions (payment_gateway, payment_gateway_subscription_id);

-- RLS
ALTER TABLE organizer_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY organizer_subscriptions_rls ON organizer_subscriptions
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Comentários
COMMENT ON TABLE organizer_subscriptions IS 'Assinaturas de planos para organizadores';
COMMENT ON COLUMN organizer_subscriptions.status IS 'Status: active, canceled, expired, past_due';
COMMENT ON COLUMN organizer_subscriptions.payment_gateway IS 'Gateway de pagamento usado (stripe, pagarme, etc.)';













