-- ============================================================
-- UNIFICARD — MIGRATION 076
-- Arquivo: 076_organizer_subscriptions.sql
-- Tipo: BILLING / ASSINATURAS (Organizadores de Eventos)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Organizadores de eventos podem contratar planos pagos
-- através de gateways externos (Stripe, Pagar.me, etc.).
--
-- Esta tabela registra o estado das assinaturas e mantém
-- histórico completo para auditoria e billing.
--
-- GOVERNANÇA
-- • O banco NÃO executa cobrança
-- • O banco NÃO renova assinaturas
-- • O banco NÃO altera status automaticamente
-- • Transições de status são feitas pela aplicação/webhooks
--
-- REGRAS CRÍTICAS
-- • Apenas 1 assinatura ATIVA por organizer
-- • Histórico de assinaturas é preservado
-- • IDs de gateway são únicos quando presentes
--
-- IDEMPOTÊNCIA
-- • Migration é idempotente
-- • Unicidade lógica é garantida por índices parciais
--
-- DEPENDÊNCIAS
-- • tenants
-- • event_organizers
--
-- ============================================================


-- ============================================================
-- 1) TABELA DE ASSINATURAS
-- ============================================================

CREATE TABLE IF NOT EXISTS organizer_subscriptions (
  subscription_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,

  organizer_id UUID NOT NULL
    REFERENCES event_organizers(id) ON DELETE CASCADE,

  -- Plano contratado
  plan VARCHAR(20) NOT NULL,

  -- Billing / lifecycle
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL,

  -- Gateway de pagamento
  payment_gateway VARCHAR(50),
  payment_gateway_subscription_id VARCHAR(255),
  payment_gateway_customer_id VARCHAR(255),

  -- Metadados
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  canceled_at TIMESTAMPTZ
);


-- ============================================================
-- 2) CONSTRAINTS DE DOMÍNIO (EVOLUTIVAS)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizer_subscriptions_plan_check'
  ) THEN
    ALTER TABLE organizer_subscriptions
      ADD CONSTRAINT organizer_subscriptions_plan_check
      CHECK (plan IN ('free', 'basic', 'pro', 'enterprise'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizer_subscriptions_status_check'
  ) THEN
    ALTER TABLE organizer_subscriptions
      ADD CONSTRAINT organizer_subscriptions_status_check
      CHECK (status IN ('active', 'canceled', 'expired', 'past_due'));
  END IF;
END $$;


-- ============================================================
-- 3) REGRAS CRÍTICAS DE UNICIDADE
-- ============================================================

-- Apenas 1 assinatura ativa por organizer
CREATE UNIQUE INDEX IF NOT EXISTS uniq_organizer_active_subscription
  ON organizer_subscriptions (organizer_id)
  WHERE status = 'active';

-- Unicidade por gateway (idempotência externa)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_subscription_gateway_id
  ON organizer_subscriptions (payment_gateway, payment_gateway_subscription_id)
  WHERE payment_gateway_subscription_id IS NOT NULL;


-- ============================================================
-- 4) ÍNDICES DE PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_subscriptions_organizer_status
  ON organizer_subscriptions (organizer_id, status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant
  ON organizer_subscriptions (tenant_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end
  ON organizer_subscriptions (current_period_end)
  WHERE status = 'active';


-- ============================================================
-- 5) RLS
-- ============================================================

ALTER TABLE organizer_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organizer_subscriptions'
      AND policyname = 'organizer_subscriptions_rls'
  ) THEN
    CREATE POLICY organizer_subscriptions_rls
      ON organizer_subscriptions
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;


-- ============================================================
-- 6) TRIGGER updated_at
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_organizer_subscriptions_updated_at'
  ) THEN
    CREATE TRIGGER trg_organizer_subscriptions_updated_at
      BEFORE UPDATE ON organizer_subscriptions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;


-- ============================================================
-- 7) COMENTÁRIOS
-- ============================================================

COMMENT ON TABLE organizer_subscriptions IS
  'Assinaturas de planos para organizadores de eventos (histórico preservado)';

COMMENT ON COLUMN organizer_subscriptions.status IS
  'Status da assinatura: active, canceled, expired, past_due';

COMMENT ON COLUMN organizer_subscriptions.plan IS
  'Plano contratado pelo organizador';

COMMENT ON COLUMN organizer_subscriptions.payment_gateway IS
  'Gateway de pagamento externo (ex: stripe, pagarme)';


-- ============================================================
-- FIM 076_organizer_subscriptions.sql
-- ============================================================













