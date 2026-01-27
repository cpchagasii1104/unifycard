-- backend/migrations/239_create_loyalty_vouchers.sql
-- SPRINT 93: LOYALTY / FIDELIDADE

-- ============================================================
-- ENUM: loyalty_voucher_status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loyalty_voucher_status') THEN
    CREATE TYPE loyalty_voucher_status AS ENUM (
      'ACTIVE',
      'USED',
      'EXPIRED',
      'CANCELLED'
    );
  END IF;
END$$;

-- ============================================================
-- ENUM: loyalty_voucher_type
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loyalty_voucher_type') THEN
    CREATE TYPE loyalty_voucher_type AS ENUM (
      'DISCOUNT_FIXED',
      'DISCOUNT_PERCENT',
      'BENEFIT_FLAG'
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: loyalty_vouchers
-- ============================================================
CREATE TABLE IF NOT EXISTS loyalty_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    status loyalty_voucher_status NOT NULL DEFAULT 'ACTIVE',
    voucher_type loyalty_voucher_type NOT NULL,
    value NUMERIC(14,2), -- para DISCOUNT_FIXED ou DISCOUNT_PERCENT
    benefit_code TEXT, -- para BENEFIT_FLAG
    expires_at TIMESTAMP WITH TIME ZONE,
    created_from_ledger_id UUID REFERENCES loyalty_ledger(id) ON DELETE SET NULL,
    used_reference_type TEXT, -- order | payment | etc
    used_reference_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    used_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_loyalty_vouchers_tenant_contact ON loyalty_vouchers(tenant_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_vouchers_tenant_status ON loyalty_vouchers(tenant_id, status) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_loyalty_vouchers_tenant_ledger ON loyalty_vouchers(tenant_id, created_from_ledger_id) WHERE created_from_ledger_id IS NOT NULL;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE loyalty_vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY loyalty_vouchers_tenant_isolation ON loyalty_vouchers FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);





