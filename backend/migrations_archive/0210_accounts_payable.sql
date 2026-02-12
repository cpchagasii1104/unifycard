-- ============================================================
-- UNIFICARD - MIGRATION 199
-- SPRINT 70: ACCOUNTS PAYABLE (CONTAS A PAGAR)
-- Tabela: accounts_payable
-- ============================================================
--
-- OBJETIVO:
-- Criar sistema de Contas a Pagar que:
-- - Integra com Purchase Orders
-- - Integra com Scheduled Actions
-- - NÃO executa pagamento automaticamente
-- - Pagamento real só ocorre quando scheduled action executa
--
-- REGRAS:
-- - Append-only (status muda, mas registros não desaparecem)
-- - Status declarativos
-- - Audit em todas as mudanças
-- - Não criar PaymentIntent automaticamente
-- - Não emitir fiscal
-- - Não pagar automaticamente
-- ============================================================

-- ============================================================
-- ENUM: Accounts Payable Status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'accounts_payable_status') THEN
    CREATE TYPE accounts_payable_status AS ENUM (
      'OPEN',        -- Aberta (não agendada)
      'SCHEDULED',   -- Agendada (tem scheduled_action)
      'PAID',        -- Paga
      'CANCELLED'    -- Cancelada
    );
  END IF;
END$$;

-- ============================================================
-- ENUM: Reference Type
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'accounts_payable_reference_type') THEN
    CREATE TYPE accounts_payable_reference_type AS ENUM (
      'PURCHASE_ORDER',  -- Criada a partir de Purchase Order
      'MANUAL'           -- Criada manualmente
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: accounts_payable
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts_payable (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Fornecedor
    supplier_id UUID NOT NULL
        REFERENCES suppliers(id) ON DELETE CASCADE,
    
    -- Referência (tipo e ID)
    reference_type accounts_payable_reference_type NOT NULL,
    reference_id UUID NOT NULL, -- purchase_order_id ou outro ID
    
    -- Valor e vencimento
    amount_cents BIGINT NOT NULL, -- Valor em centavos
    currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
    due_date DATE NOT NULL, -- Data de vencimento
    
    -- Status
    status accounts_payable_status NOT NULL DEFAULT 'OPEN',
    
    -- Scheduled Action (opcional)
    scheduled_action_id UUID
        REFERENCES scheduled_actions(id) ON DELETE SET NULL,
    
    -- Pagamento
    paid_at TIMESTAMP WITH TIME ZONE,
    paid_by_actor_id UUID
        REFERENCES actors(actor_id) ON DELETE SET NULL,
    paid_by_user_id UUID,
    
    -- Cancelamento
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancelled_by_actor_id UUID
        REFERENCES actors(actor_id) ON DELETE SET NULL,
    cancelled_by_user_id UUID,
    cancellation_reason TEXT,
    
    -- Criação
    created_by_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    created_by_user_id UUID,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_amount_positive CHECK (amount_cents > 0),
    CONSTRAINT check_scheduled_action_only_when_scheduled CHECK (
        (status = 'SCHEDULED' AND scheduled_action_id IS NOT NULL) OR
        (status != 'SCHEDULED' AND scheduled_action_id IS NULL)
    )
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_accounts_payable_tenant_id
    ON accounts_payable(tenant_id);

-- Índice para buscar por fornecedor
CREATE INDEX IF NOT EXISTS idx_accounts_payable_supplier
    ON accounts_payable(tenant_id, supplier_id, status);

-- Índice para buscar por status
CREATE INDEX IF NOT EXISTS idx_accounts_payable_status
    ON accounts_payable(tenant_id, status, due_date);

-- Índice para buscar por vencimento
CREATE INDEX IF NOT EXISTS idx_accounts_payable_due_date
    ON accounts_payable(tenant_id, due_date)
    WHERE status IN ('OPEN', 'SCHEDULED');

-- Índice para buscar por referência
CREATE INDEX IF NOT EXISTS idx_accounts_payable_reference
    ON accounts_payable(tenant_id, reference_type, reference_id);

-- Índice para buscar por scheduled_action
CREATE INDEX IF NOT EXISTS idx_accounts_payable_scheduled_action
    ON accounts_payable(tenant_id, scheduled_action_id)
    WHERE scheduled_action_id IS NOT NULL;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE accounts_payable ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem contas do próprio tenant
CREATE POLICY accounts_payable_tenant_isolation
    ON accounts_payable
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================
-- TRIGGERS
-- ============================================================
-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_accounts_payable_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_accounts_payable_updated_at
    BEFORE UPDATE ON accounts_payable
    FOR EACH ROW
    EXECUTE FUNCTION update_accounts_payable_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE accounts_payable IS 'Contas a Pagar. Append-only: status muda, mas registros não desaparecem.';
COMMENT ON COLUMN accounts_payable.status IS 'Status da conta: OPEN, SCHEDULED, PAID, CANCELLED';
COMMENT ON COLUMN accounts_payable.reference_type IS 'Tipo de referência: PURCHASE_ORDER, MANUAL';
COMMENT ON COLUMN accounts_payable.scheduled_action_id IS 'Referência à scheduled_action quando status = SCHEDULED';
COMMENT ON COLUMN accounts_payable.due_date IS 'Data de vencimento da conta';






