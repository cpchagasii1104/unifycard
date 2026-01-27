-- ============================================================
-- UNIFICARD - MIGRATION 177
-- SPRINT 40.1: MARKETPLACE EXECUÇÃO - Split Declarativo
-- Tabela: payment_intent_splits
-- ============================================================
--
-- OBJETIVO:
-- Criar estrutura para splits declarativos de pagamento.
-- Representa como o dinheiro deve ser dividido, sem executar.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Split é declarativo (não executa nada)
-- - Soma dos splits = intent.amount (validado no service)
-- - Nenhuma execução ocorre aqui
-- ============================================================

-- ============================================================
-- ENUM: Role do split
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_split_role') THEN
        CREATE TYPE payment_split_role AS ENUM (
            'SELLER',      -- Vendedor (recebedor principal)
            'PLATFORM',    -- Plataforma (taxa)
            'FUND',        -- Fundo (regional, reserva, etc)
            'OTHER'        -- Outro (customizado)
        );
    END IF;
END $$;

-- ============================================================
-- TABELA: payment_intent_splits
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_intent_splits (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Payment Intent associado
    payment_intent_id UUID NOT NULL
        REFERENCES payment_intents(id) ON DELETE CASCADE,
    
    -- Recipiente do split (actor)
    recipient_actor_id UUID NOT NULL
        REFERENCES actors(actor_id) ON DELETE RESTRICT,
    
    -- Valor do split (numeric para precisão)
    amount NUMERIC(20, 2) NOT NULL
        CHECK (amount > 0),
    
    -- Porcentagem (opcional, para referência)
    percentage NUMERIC(5, 2),
    
    -- Role do split
    role payment_split_role NOT NULL,
    
    -- Metadados adicionais (JSONB)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_payment_intent_splits_tenant
    ON payment_intent_splits (tenant_id);

-- Índice para buscar por payment intent
CREATE INDEX IF NOT EXISTS idx_payment_intent_splits_intent
    ON payment_intent_splits (tenant_id, payment_intent_id);

-- Índice para buscar por recipient
CREATE INDEX IF NOT EXISTS idx_payment_intent_splits_recipient
    ON payment_intent_splits (tenant_id, recipient_actor_id);

-- Índice para buscar por role
CREATE INDEX IF NOT EXISTS idx_payment_intent_splits_role
    ON payment_intent_splits (tenant_id, role);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE payment_intent_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_intent_splits_rls ON payment_intent_splits
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE payment_intent_splits IS
    'Splits declarativos de pagamento. Representa como o dinheiro deve ser dividido, sem executar.';

COMMENT ON COLUMN payment_intent_splits.payment_intent_id IS
    'Payment Intent associado. Soma dos splits deve igualar intent.amount.';

COMMENT ON COLUMN payment_intent_splits.recipient_actor_id IS
    'Actor que receberá este split.';

COMMENT ON COLUMN payment_intent_splits.amount IS
    'Valor do split. Soma de todos os splits deve igualar intent.amount.';

COMMENT ON COLUMN payment_intent_splits.percentage IS
    'Porcentagem (opcional, para referência). Não é usado para cálculo.';

COMMENT ON COLUMN payment_intent_splits.role IS
    'Role do split: SELLER (vendedor), PLATFORM (taxa), FUND (fundo), OTHER (outro).';







