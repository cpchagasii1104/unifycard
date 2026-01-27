-- backend/migrations/236_create_loyalty_accounts.sql
-- SPRINT 93: LOYALTY / FIDELIDADE

-- ============================================================
-- ENUM: loyalty_account_status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loyalty_account_status') THEN
    CREATE TYPE loyalty_account_status AS ENUM (
      'ACTIVE',
      'SUSPENDED'
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: loyalty_accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS loyalty_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    status loyalty_account_status NOT NULL DEFAULT 'ACTIVE',
    points_balance BIGINT NOT NULL DEFAULT 0,
    lifetime_earned BIGINT NOT NULL DEFAULT 0,
    lifetime_redeemed BIGINT NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT loyalty_accounts_unique_contact UNIQUE (tenant_id, contact_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_tenant_contact ON loyalty_accounts(tenant_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_tenant_status ON loyalty_accounts(tenant_id, status) WHERE status = 'ACTIVE';

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE loyalty_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY loyalty_accounts_tenant_isolation ON loyalty_accounts FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_loyalty_accounts_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_update_loyalty_accounts_updated_at BEFORE UPDATE ON loyalty_accounts FOR EACH ROW EXECUTE FUNCTION update_loyalty_accounts_updated_at();





