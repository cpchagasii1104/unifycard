-- ============================================================
-- UNIFICARD - MIGRATION 227
-- SPRINT 86: PAYMENT LINKS (LINK DE PAGAMENTO)
-- Tabela: payment_link_payments (append-only)
-- ============================================================
--
-- OBJETIVO:
-- Rastrear pagamentos realizados via payment links (append-only).
-- Histórico completo para auditoria e conciliação.
--
-- REGRAS:
-- - Append-only (nunca deleta)
-- - 1 registro por PaymentIntent criado via link
-- - Tudo auditável
-- ============================================================

-- ============================================================
-- ENUM: Payment Link Payment Status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_link_payment_status') THEN
    CREATE TYPE payment_link_payment_status AS ENUM (
      'PENDING',   -- PaymentIntent criado, aguardando pagamento
      'SUCCESS',   -- Pagamento confirmado
      'FAILED',    -- Pagamento falhou
      'CANCELLED'  -- Pagamento cancelado
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: payment_link_payments
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_link_payments (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Vínculos
    payment_link_id UUID NOT NULL
        REFERENCES payment_links(id) ON DELETE CASCADE,
    payment_intent_id UUID NOT NULL
        REFERENCES payment_intents(id) ON DELETE CASCADE,
    payment_transaction_id UUID
        REFERENCES payment_transactions(id) ON DELETE SET NULL,
    
    -- Contact do pagador (se informado)
    contact_id UUID
        REFERENCES contacts(id) ON DELETE SET NULL,
    
    -- Status
    status payment_link_payment_status NOT NULL DEFAULT 'PENDING',
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT payment_link_payments_unique_intent UNIQUE (tenant_id, payment_intent_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_payment_link_payments_tenant_id
    ON payment_link_payments(tenant_id);

-- Índice para buscar por payment_link
CREATE INDEX IF NOT EXISTS idx_payment_link_payments_link
    ON payment_link_payments(tenant_id, payment_link_id, created_at DESC);

-- Índice para buscar por payment_intent
CREATE INDEX IF NOT EXISTS idx_payment_link_payments_intent
    ON payment_link_payments(tenant_id, payment_intent_id);

-- Índice para buscar por contact
CREATE INDEX IF NOT EXISTS idx_payment_link_payments_contact
    ON payment_link_payments(tenant_id, contact_id)
    WHERE contact_id IS NOT NULL;

-- Índice para buscar por status
CREATE INDEX IF NOT EXISTS idx_payment_link_payments_status
    ON payment_link_payments(tenant_id, status, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE payment_link_payments ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem pagamentos do próprio tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'payment_link_payments'
      AND policyname = 'payment_link_payments_tenant_isolation'
  ) THEN
    CREATE POLICY payment_link_payments_tenant_isolation
      ON payment_link_payments
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- TRIGGERS
-- ============================================================
-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_payment_link_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payment_link_payments_updated_at
    BEFORE UPDATE ON payment_link_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_link_payments_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE payment_link_payments IS 'Pagamentos realizados via payment links (append-only). Histórico completo para auditoria.';
COMMENT ON COLUMN payment_link_payments.status IS 'Status do pagamento: PENDING, SUCCESS, FAILED, CANCELLED';





