-- backend/migrations/237_create_loyalty_ledger.sql
-- SPRINT 93: LOYALTY / FIDELIDADE

-- ============================================================
-- ENUM: loyalty_ledger_entry_type
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loyalty_ledger_entry_type') THEN
    CREATE TYPE loyalty_ledger_entry_type AS ENUM (
      'EARN',
      'REDEEM',
      'ADJUST'
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: loyalty_ledger (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS loyalty_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    entry_type loyalty_ledger_entry_type NOT NULL,
    points BIGINT NOT NULL, -- signed (positivo para EARN, negativo para REDEEM)
    reference_type TEXT, -- payment_transaction | order | ticket_sale | tab | manual
    reference_id UUID,
    reason_code TEXT,
    description TEXT,
    created_by_actor_id UUID REFERENCES actors(actor_id) ON DELETE SET NULL,
    created_by_user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Idempotência: evitar duplicar earn em retries
    CONSTRAINT loyalty_ledger_idempotency UNIQUE (tenant_id, reference_type, reference_id, entry_type)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_tenant_contact_created ON loyalty_ledger(tenant_id, contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_tenant_reference ON loyalty_ledger(tenant_id, reference_type, reference_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE loyalty_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY loyalty_ledger_tenant_isolation ON loyalty_ledger FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);





