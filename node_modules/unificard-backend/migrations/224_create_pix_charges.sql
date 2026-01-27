-- ============================================================
-- UNIFICARD - MIGRATION 224
-- SPRINT 85: PIX INTEGRATION (REAL, SEGURA, CANÔNICA)
-- Tabela: pix_charges
-- ============================================================
--
-- OBJETIVO:
-- Criar infraestrutura canônica de PIX sem depender de provider
-- específico agora, mas já com webhook e conciliação.
--
-- REGRAS:
-- - 1 PixCharge por PaymentIntent
-- - Idempotência por payment_intent_id
-- - Webhook sempre auditável e idempotente
-- - Nenhuma automação invisível
-- ============================================================

-- ============================================================
-- ENUM: PIX Charge Status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pix_charge_status') THEN
    CREATE TYPE pix_charge_status AS ENUM (
      'CREATED',    -- Charge criado, aguardando pagamento
      'PAID',       -- Charge pago (via webhook)
      'EXPIRED',    -- Charge expirado
      'CANCELLED'   -- Charge cancelado
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: pix_charges
-- ============================================================
CREATE TABLE IF NOT EXISTS pix_charges (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Vínculo com PaymentIntent
    payment_intent_id UUID NOT NULL
        REFERENCES payment_intents(id) ON DELETE CASCADE,
    
    -- Provider
    provider VARCHAR(50) NOT NULL DEFAULT 'MOCK', -- MOCK, ASAAS, MERCADOPAGO, etc.
    provider_charge_id VARCHAR(255) NOT NULL, -- ID do charge no provider
    
    -- Valores
    amount BIGINT NOT NULL, -- Valor em centavos
    currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
    
    -- Status
    status pix_charge_status NOT NULL DEFAULT 'CREATED',
    
    -- Expiração
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Pagamento
    paid_at TIMESTAMP WITH TIME ZONE,
    
    -- Payload snapshot (QR Code, copia-e-cola, etc.)
    payload_snapshot JSONB DEFAULT '{}'::jsonb,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_amount_positive CHECK (amount > 0),
    CONSTRAINT check_expires_at_future CHECK (expires_at > created_at),
    CONSTRAINT pix_charges_unique_per_intent UNIQUE (tenant_id, payment_intent_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_pix_charges_tenant_id
    ON pix_charges(tenant_id);

-- Índice para buscar por payment_intent
CREATE INDEX IF NOT EXISTS idx_pix_charges_payment_intent
    ON pix_charges(tenant_id, payment_intent_id);

-- Índice para buscar por provider_charge_id
CREATE INDEX IF NOT EXISTS idx_pix_charges_provider_charge
    ON pix_charges(tenant_id, provider, provider_charge_id);

-- Índice para buscar por status
CREATE INDEX IF NOT EXISTS idx_pix_charges_status
    ON pix_charges(tenant_id, status, created_at)
    WHERE status IN ('CREATED', 'PAID');

-- Índice para buscar charges expirados
CREATE INDEX IF NOT EXISTS idx_pix_charges_expired
    ON pix_charges(tenant_id, expires_at)
    WHERE status = 'CREATED';

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE pix_charges ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem charges do próprio tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'pix_charges'
      AND policyname = 'pix_charges_tenant_isolation'
  ) THEN
    CREATE POLICY pix_charges_tenant_isolation
      ON pix_charges
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- TRIGGERS
-- ============================================================
-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_pix_charges_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pix_charges_updated_at
    BEFORE UPDATE ON pix_charges
    FOR EACH ROW
    EXECUTE FUNCTION update_pix_charges_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE pix_charges IS 'Charges PIX. 1 PixCharge por PaymentIntent. Idempotência por payment_intent_id.';
COMMENT ON COLUMN pix_charges.provider IS 'Provider: MOCK, ASAAS, MERCADOPAGO, etc.';
COMMENT ON COLUMN pix_charges.provider_charge_id IS 'ID do charge no provider (para lookup)';
COMMENT ON COLUMN pix_charges.payload_snapshot IS 'Snapshot do payload (QR Code, copia-e-cola, etc.)';
COMMENT ON COLUMN pix_charges.status IS 'Status: CREATED, PAID, EXPIRED, CANCELLED';





