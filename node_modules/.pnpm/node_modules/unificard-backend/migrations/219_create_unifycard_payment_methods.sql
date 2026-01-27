-- ============================================================
-- UNIFICARD - MIGRATION 219
-- SPRINT 82: UNIFYCARD MULTI-MÉTODOS (CRÉDITO, DÉBITO, PIX, VALE)
-- Tabela: unifycard_payment_methods
-- ============================================================
--
-- OBJETIVO:
-- Preparar o UnifyCard como HUB de métodos de pagamento,
-- com taxas regionais e retorno econômico para a comunidade,
-- sem integração real com adquirentes externas ainda.
--
-- REGRAS:
-- - Nenhuma integração real
-- - Nenhum dinheiro externo
-- - Apenas modelagem
-- - Tudo auditável
-- ============================================================

-- ============================================================
-- ENUM: UnifyCard Payment Method Type
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'unifycard_method_type') THEN
    CREATE TYPE unifycard_method_type AS ENUM (
      'CREDIT',           -- Crédito
      'DEBIT',            -- Débito
      'PIX',              -- Pix
      'CASH',             -- Dinheiro
      'VALE_REFEICAO',    -- Vale Refeição
      'VALE_ALIMENTACAO'  -- Vale Alimentação
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: unifycard_payment_methods
-- ============================================================
CREATE TABLE IF NOT EXISTS unifycard_payment_methods (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL
        REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    
    -- Tipo de método
    method_type unifycard_method_type NOT NULL,
    
    -- Provider (sempre UNIFYCARD para esta tabela)
    provider VARCHAR(50) NOT NULL DEFAULT 'UNIFYCARD',
    
    -- Taxa (percentual, ex: 0.0299 = 2.99%)
    fee_percentage NUMERIC(5, 4) NOT NULL DEFAULT 0,
    
    -- Dias para liquidação (0 = imediato)
    settlement_delay_days INTEGER NOT NULL DEFAULT 0,
    
    -- Metadados
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unifycard_methods_unique_per_tenant_type UNIQUE (tenant_id, method_type)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
-- Índice para buscar por tenant
CREATE INDEX IF NOT EXISTS idx_unifycard_methods_tenant_id
    ON unifycard_payment_methods(tenant_id);

-- Índice para buscar por tipo
CREATE INDEX IF NOT EXISTS idx_unifycard_methods_type
    ON unifycard_payment_methods(tenant_id, method_type);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE unifycard_payment_methods ENABLE ROW LEVEL SECURITY;

-- Policy: usuários só veem methods do próprio tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'unifycard_payment_methods'
      AND policyname = 'unifycard_methods_tenant_isolation'
  ) THEN
    CREATE POLICY unifycard_methods_tenant_isolation
      ON unifycard_payment_methods
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TABLE unifycard_payment_methods IS 'Métodos de pagamento UnifyCard com taxas regionais. Nenhuma integração real. Apenas modelagem.';
COMMENT ON COLUMN unifycard_payment_methods.method_type IS 'Tipo: CREDIT, DEBIT, PIX, CASH, VALE_REFEICAO, VALE_ALIMENTACAO';
COMMENT ON COLUMN unifycard_payment_methods.fee_percentage IS 'Taxa percentual (ex: 0.0299 = 2.99%)';
COMMENT ON COLUMN unifycard_payment_methods.settlement_delay_days IS 'Dias para liquidação (0 = imediato)';






