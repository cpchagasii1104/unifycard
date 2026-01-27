-- backend/migrations/243_create_promo_benefits.sql
-- SPRINT 94: PRESENÇA + CHECK-IN SOCIAL + BENEFÍCIOS PROMOCIONAIS

-- ============================================================
-- ENUM: promo_benefit_type
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promo_benefit_type') THEN
    CREATE TYPE promo_benefit_type AS ENUM (
      'LOYALTY_POINTS',
      'LOYALTY_MULTIPLIER',
      'VOUCHER'
    );
  END IF;
END$$;

-- ============================================================
-- ENUM: promo_benefit_status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'promo_benefit_status') THEN
    CREATE TYPE promo_benefit_status AS ENUM (
      'ACTIVE',
      'INACTIVE'
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: promo_benefits
-- ============================================================
CREATE TABLE IF NOT EXISTS promo_benefits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    context_type presence_context_type NOT NULL,
    context_id UUID NOT NULL,
    benefit_type promo_benefit_type NOT NULL,
    benefit_value NUMERIC(14,2) NOT NULL,
    status promo_benefit_status NOT NULL DEFAULT 'ACTIVE',
    requires_checkin BOOLEAN NOT NULL DEFAULT true,
    max_redemptions INT,
    per_contact_limit INT NOT NULL DEFAULT 1,
    valid_from TIMESTAMP WITH TIME ZONE,
    valid_to TIMESTAMP WITH TIME ZONE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: promo_benefit_redemptions (append-only, idempotência)
-- ============================================================
CREATE TABLE IF NOT EXISTS promo_benefit_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    benefit_id UUID NOT NULL REFERENCES promo_benefits(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    checkin_id UUID REFERENCES checkins(id) ON DELETE SET NULL,
    loyalty_ledger_id UUID REFERENCES loyalty_ledger(id) ON DELETE SET NULL,
    voucher_id UUID REFERENCES loyalty_vouchers(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Idempotência: um contact só pode resgatar um benefit uma vez (ou per_contact_limit vezes)
    CONSTRAINT promo_benefit_redemptions_idempotency UNIQUE (tenant_id, benefit_id, contact_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_promo_benefits_tenant_context ON promo_benefits(tenant_id, context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_promo_benefits_tenant_status ON promo_benefits(tenant_id, status) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_promo_benefits_valid_dates ON promo_benefits(tenant_id, valid_from, valid_to) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_promo_benefit_redemptions_tenant_benefit ON promo_benefit_redemptions(tenant_id, benefit_id);
CREATE INDEX IF NOT EXISTS idx_promo_benefit_redemptions_tenant_contact ON promo_benefit_redemptions(tenant_id, contact_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE promo_benefits ENABLE ROW LEVEL SECURITY;
CREATE POLICY promo_benefits_tenant_isolation ON promo_benefits FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

ALTER TABLE promo_benefit_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY promo_benefit_redemptions_tenant_isolation ON promo_benefit_redemptions FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);





