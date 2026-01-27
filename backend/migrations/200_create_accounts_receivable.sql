-- ============================================================
-- UNIFICARD - MIGRATION 200
-- SPRINT 71: ACCOUNTS RECEIVABLE (CONTAS A RECEBER)
-- Tabela: accounts_receivable
-- ============================================================
--
-- OBJETIVO:
-- Criar sistema de Contas a Receber que:
-- - Representa direito de recebimento futuro
-- - Integra com Payment Execution, PDV, Service Orders, Event Tickets
-- - NÃO executa pagamento
-- - É totalmente auditável
--
-- REGRAS:
-- - Append-only (status muda, mas registros não desaparecem)
-- - Status declarativos
-- - Audit em todas as mudanças
-- - Accounts Receivable ≠ Payment
-- - Accounts Receivable ≠ Ledger
-- - Nenhuma movimentação financeira
-- ============================================================

-- ============================================================
-- ENUM: Accounts Receivable Status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'accounts_receivable_status') THEN
    CREATE TYPE accounts_receivable_status AS ENUM (
      'PENDING',   -- Pendente (aguardando recebimento)
      'RECEIVED',  -- Recebido
      'CANCELLED', -- Cancelado
      'EXPIRED'    -- Expirado (não recebido dentro do prazo)
    );
  END IF;
END$$;

-- ============================================================
-- ENUM: Source Type
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'accounts_receivable_source_type') THEN
    CREATE TYPE accounts_receivable_source_type AS ENUM (
      'MARKETPLACE_ORDER',  -- Venda do marketplace
      'PDV_ORDER',          -- Venda do PDV
      'SERVICE_ORDER',      -- Ordem de serviço
      'EVENT_TICKET'        -- Ingresso de evento
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: accounts_receivable
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts_receivable (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Actor que deve receber (vendedor/prestador)
    actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    
    -- Origem da conta
    source_type accounts_receivable_source_type NOT NULL,
    source_id UUID NOT NULL, -- order_id, payment_intent_id, service_order_id, event_ticket_id
    
    -- Valor e moeda
    amount_cents BIGINT NOT NULL, -- Valor em centavos
    currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
    
    -- Status
    status accounts_receivable_status NOT NULL DEFAULT 'PENDING',
    
    -- Datas
    expected_at TIMESTAMP WITH TIME ZONE NOT NULL, -- Data esperada de recebimento
    received_at TIMESTAMP WITH TIME ZONE, -- Data real de recebimento
    
    -- Método de pagamento (opcional, futuro)
    payment_method VARCHAR(50), -- CASH, PIX, CREDIT_CARD, etc.
    
    -- Recebimento
    received_by_actor_id UUID
        REFERENCES actors(actor_id) ON DELETE SET NULL,
    received_by_user_id UUID,
    
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
    CONSTRAINT check_received_at_only_when_received CHECK (
        (status = 'RECEIVED' AND received_at IS NOT NULL) OR
        (status != 'RECEIVED' AND received_at IS NULL)
    )
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_tenant_id
    ON accounts_receivable(tenant_id);

-- Índice para buscar por actor (quem deve receber)
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_actor
    ON accounts_receivable(tenant_id, actor_id, status);

-- Índice para buscar por status
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_status
    ON accounts_receivable(tenant_id, status, expected_at);

-- Índice para buscar por data esperada
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_expected
    ON accounts_receivable(tenant_id, expected_at)
    WHERE status = 'PENDING';

-- Índice para buscar por origem
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_source
    ON accounts_receivable(tenant_id, source_type, source_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE accounts_receivable ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem contas do próprio tenant
CREATE POLICY accounts_receivable_tenant_isolation
    ON accounts_receivable
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================
-- TRIGGERS
-- ============================================================
-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_accounts_receivable_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_accounts_receivable_updated_at
    BEFORE UPDATE ON accounts_receivable
    FOR EACH ROW
    EXECUTE FUNCTION update_accounts_receivable_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE accounts_receivable IS 'Contas a Receber. Append-only: status muda, mas registros não desaparecem. Representa direito de recebimento futuro.';
COMMENT ON COLUMN accounts_receivable.status IS 'Status da conta: PENDING, RECEIVED, CANCELLED, EXPIRED';
COMMENT ON COLUMN accounts_receivable.source_type IS 'Tipo de origem: MARKETPLACE_ORDER, PDV_ORDER, SERVICE_ORDER, EVENT_TICKET';
COMMENT ON COLUMN accounts_receivable.expected_at IS 'Data esperada de recebimento';
COMMENT ON COLUMN accounts_receivable.payment_method IS 'Método de pagamento (opcional, futuro)';






