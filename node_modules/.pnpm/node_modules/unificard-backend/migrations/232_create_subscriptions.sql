-- backend/migrations/232_create_subscriptions.sql
-- SPRINT 87: ASSINATURAS (RECORRÊNCIA AUDITÁVEL)

-- ============================================================
-- ENUM: subscription_interval
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_interval') THEN
    CREATE TYPE subscription_interval AS ENUM (
      'WEEKLY',
      'MONTHLY',
      'YEARLY'
    );
  END IF;
END$$;

-- ============================================================
-- ENUM: subscription_status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE subscription_status AS ENUM (
      'ACTIVE',
      'PAUSED',
      'CANCELLED'
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    payment_link_id UUID NOT NULL REFERENCES payment_links(id) ON DELETE CASCADE,
    amount NUMERIC(14,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'BRL',
    interval subscription_interval NOT NULL,
    interval_count INT NOT NULL DEFAULT 1,
    day_of_month INT, -- Para MONTHLY (1..28) para evitar bug de mês curto
    next_run_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status subscription_status NOT NULL DEFAULT 'ACTIVE',
    max_failures INT NOT NULL DEFAULT 3,
    failure_count INT NOT NULL DEFAULT 0,
    last_run_at TIMESTAMP WITH TIME ZONE,
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_failure_at TIMESTAMP WITH TIME ZONE,
    last_payment_intent_id UUID,
    last_error_code TEXT,
    last_error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by_actor_id UUID NOT NULL REFERENCES actors(actor_id) ON DELETE CASCADE,
    created_by_user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT subscriptions_day_of_month_check CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 28))
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_status_next_run ON subscriptions(tenant_id, status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_contact ON subscriptions(tenant_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_payment_link ON subscriptions(tenant_id, payment_link_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_run_at ON subscriptions(next_run_at) WHERE status = 'ACTIVE';

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_tenant_isolation ON subscriptions FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_subscriptions_updated_at();





