-- ============================================================
-- UNIFICARD - MIGRATION 202
-- SPRINT 73: UNIFYCARD ACQUIRING (SIMULADO, CANÔNICO)
-- Tabela: unifycard_transactions
-- ============================================================
--
-- OBJETIVO:
-- Criar camada de adquirência UnifyCard, simulando:
-- - Autorização
-- - Captura
-- - Liquidação
-- - Taxas regionais
--
-- REGRAS:
-- - Nenhuma integração externa real
-- - Nenhuma integração com Visa/Mastercard
-- - Nenhum dinheiro real
-- - Tudo auditável e reversível
-- - UnifyCard ≠ Banco externo
-- - UnifyCard ≠ Visa/Mastercard
-- ============================================================

-- ============================================================
-- ENUM: UnifyCard Transaction Status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'unifycard_transaction_status') THEN
    CREATE TYPE unifycard_transaction_status AS ENUM (
      'AUTHORIZED',  -- Autorizado (aguardando captura)
      'CAPTURED',    -- Capturado (aguardando liquidação)
      'SETTLED',     -- Liquidado (valor creditado)
      'FAILED'       -- Falhou
    );
  END IF;
END$$;

-- ============================================================
-- ENUM: UnifyCard Transaction Type
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'unifycard_transaction_type') THEN
    CREATE TYPE unifycard_transaction_type AS ENUM (
      'CREDIT',   -- Cartão de Crédito
      'DEBIT',    -- Cartão de Débito
      'PIX',      -- Pix (via UnifyCard)
      'VOUCHER'   -- Voucher
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: unifycard_transactions
-- ============================================================
CREATE TABLE IF NOT EXISTS unifycard_transactions (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Actor (vendedor/prestador)
    actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    
    -- Referências
    payment_intent_id UUID NOT NULL,
    payment_method_id UUID
        REFERENCES payment_methods(id) ON DELETE SET NULL,
    
    -- Tipo e status
    transaction_type unifycard_transaction_type NOT NULL,
    status unifycard_transaction_status NOT NULL DEFAULT 'AUTHORIZED',
    
    -- Valores
    gross_amount_cents BIGINT NOT NULL, -- Valor bruto
    fee_amount_cents BIGINT NOT NULL DEFAULT 0, -- Taxa (em centavos)
    net_amount_cents BIGINT NOT NULL, -- Valor líquido (gross - fee)
    
    -- Conta regional (UnifyBank)
    regional_account_id UUID, -- Conta regional para liquidação
    
    -- Datas
    authorized_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    captured_at TIMESTAMP WITH TIME ZONE,
    settled_at TIMESTAMP WITH TIME ZONE,
    
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
    CONSTRAINT check_gross_amount_positive CHECK (gross_amount_cents > 0),
    CONSTRAINT check_fee_amount_non_negative CHECK (fee_amount_cents >= 0),
    CONSTRAINT check_net_amount_positive CHECK (net_amount_cents > 0),
    CONSTRAINT check_net_equals_gross_minus_fee CHECK (net_amount_cents = gross_amount_cents - fee_amount_cents)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_unifycard_transactions_tenant_id
    ON unifycard_transactions(tenant_id);

-- Índice para buscar por actor
CREATE INDEX IF NOT EXISTS idx_unifycard_transactions_actor
    ON unifycard_transactions(tenant_id, actor_id, status);

-- Índice para buscar por status
CREATE INDEX IF NOT EXISTS idx_unifycard_transactions_status
    ON unifycard_transactions(tenant_id, status, created_at);

-- Índice para buscar por payment_intent
CREATE INDEX IF NOT EXISTS idx_unifycard_transactions_payment_intent
    ON unifycard_transactions(tenant_id, payment_intent_id);

-- Índice para buscar por payment_method
CREATE INDEX IF NOT EXISTS idx_unifycard_transactions_payment_method
    ON unifycard_transactions(tenant_id, payment_method_id)
    WHERE payment_method_id IS NOT NULL;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE unifycard_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem transações do próprio tenant
CREATE POLICY unifycard_transactions_tenant_isolation
    ON unifycard_transactions
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================
-- TRIGGERS
-- ============================================================
-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_unifycard_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_unifycard_transactions_updated_at
    BEFORE UPDATE ON unifycard_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_unifycard_transactions_updated_at();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE unifycard_transactions IS 'Transações UnifyCard. Simulação de adquirência. Nenhuma integração externa real.';
COMMENT ON COLUMN unifycard_transactions.status IS 'Status: AUTHORIZED, CAPTURED, SETTLED, FAILED';
COMMENT ON COLUMN unifycard_transactions.transaction_type IS 'Tipo: CREDIT, DEBIT, PIX, VOUCHER';
COMMENT ON COLUMN unifycard_transactions.fee_amount_cents IS 'Taxa em centavos (calculada, não executada)';
COMMENT ON COLUMN unifycard_transactions.net_amount_cents IS 'Valor líquido = gross - fee';






