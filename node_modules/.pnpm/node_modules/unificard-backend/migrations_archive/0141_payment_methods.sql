-- ============================================================
-- UNIFICARD - MIGRATION 201
-- SPRINT 72: PAYMENT METHODS + UNIFYCARD CORE
-- Tabela: payment_methods
-- ============================================================
--
-- OBJETIVO:
-- Criar domínio canônico de Payment Methods (Meios de Pagamento):
-- - UnifyCard (adquirente própria futura)
-- - Pix
-- - Crédito
-- - Débito
-- - Dinheiro (PDV)
-- - Vouchers / Vale-alimentação
--
-- REGRAS:
-- - Nenhuma integração externa real
-- - Nenhuma adquirente (Cielo, Stone, etc.)
-- - Apenas modelagem correta + fluxo canônico
-- - Payment Method ≠ Acquirer
-- - Payment Method ≠ Payment Execution
-- - Nenhum dinheiro real
-- - Nenhuma taxa aplicada
-- ============================================================

-- ============================================================
-- ENUM: Payment Method Type
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_type') THEN
    CREATE TYPE payment_method_type AS ENUM (
      'CASH',         -- Dinheiro (PDV)
      'PIX',          -- Pix
      'CREDIT_CARD',  -- Cartão de Crédito
      'DEBIT_CARD',   -- Cartão de Débito
      'VOUCHER',      -- Voucher / Vale-alimentação
      'UNIFYCARD'     -- UnifyCard (adquirente própria)
    );
  END IF;
END$$;

-- ============================================================
-- ENUM: Payment Method Provider
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_provider') THEN
    CREATE TYPE payment_method_provider AS ENUM (
      'INTERNAL',     -- Método interno (CASH, PIX direto)
      'UNIFYCARD',    -- UnifyCard (adquirente própria)
      'EXTERNAL'      -- Adquirente externa (futuro)
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: payment_methods
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_methods (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Actor que possui o método
    actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    
    -- Tipo e provedor
    type payment_method_type NOT NULL,
    provider payment_method_provider NOT NULL DEFAULT 'INTERNAL',
    
    -- Taxas e liquidação (declarativos, não executam nada)
    fee_percentage NUMERIC(5, 4) NOT NULL DEFAULT 0, -- Ex: 0.0299 = 2.99%
    settlement_days INTEGER NOT NULL DEFAULT 0, -- Dias para liquidação (0 = imediato)
    
    -- Default
    is_default BOOLEAN NOT NULL DEFAULT false,
    
    -- Criação
    created_by_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE CASCADE,
    created_by_user_id UUID,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_fee_percentage_range CHECK (fee_percentage >= 0 AND fee_percentage <= 1),
    CONSTRAINT check_settlement_days_non_negative CHECK (settlement_days >= 0)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant_id
    ON payment_methods(tenant_id);

-- Índice para buscar por actor
CREATE INDEX IF NOT EXISTS idx_payment_methods_actor
    ON payment_methods(tenant_id, actor_id, is_default);

-- Índice para buscar por tipo
CREATE INDEX IF NOT EXISTS idx_payment_methods_type
    ON payment_methods(tenant_id, actor_id, type);

-- Índice para buscar método default
CREATE INDEX IF NOT EXISTS idx_payment_methods_default
    ON payment_methods(tenant_id, actor_id, is_default)
    WHERE is_default = true;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem métodos do próprio tenant
CREATE POLICY payment_methods_tenant_isolation
    ON payment_methods
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================
-- TRIGGER: Apenas 1 método default por actor
-- ============================================================
CREATE OR REPLACE FUNCTION ensure_single_default_payment_method()
RETURNS TRIGGER AS $$
BEGIN
    -- Se está marcando como default, remover default dos outros
    IF NEW.is_default = true THEN
        UPDATE payment_methods
        SET is_default = false
        WHERE tenant_id = NEW.tenant_id
          AND actor_id = NEW.actor_id
          AND id != NEW.id
          AND is_default = true;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_default_payment_method
    BEFORE INSERT OR UPDATE ON payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_default_payment_method();

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE payment_methods IS 'Métodos de Pagamento. Domínio canônico para modelar meios de pagamento. Nenhuma execução financeira.';
COMMENT ON COLUMN payment_methods.type IS 'Tipo de método: CASH, PIX, CREDIT_CARD, DEBIT_CARD, VOUCHER, UNIFYCARD';
COMMENT ON COLUMN payment_methods.provider IS 'Provedor: INTERNAL, UNIFYCARD, EXTERNAL';
COMMENT ON COLUMN payment_methods.fee_percentage IS 'Taxa percentual (declarativa, não executada)';
COMMENT ON COLUMN payment_methods.settlement_days IS 'Dias para liquidação (declarativo, não executado)';
COMMENT ON COLUMN payment_methods.is_default IS 'Se é o método padrão do actor (apenas 1 por actor)';






