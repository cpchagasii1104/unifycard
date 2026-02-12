-- ============================================================
-- UNIFICARD - MIGRATION 219
-- SPRINT 82: UNIFYCARD MULTI-MÉTODOS (CRÉDITO, DÉBITO, PIX, VALE)
-- Tabela: unifycard_payment_methods
-- ============================================================
--
-- OBJETIVO:
-- Preparar o UnifyCard como HUB de métodos de pagamento,
-- com taxas regionais e retorno econômico para a comunidade,
-- sem integração real com adquirentes externas.
--
-- REGRAS:
-- - Nenhuma integração real
-- - Nenhum dinheiro externo
-- - Apenas modelagem
-- - Tudo auditável
-- ============================================================

BEGIN;

-- ============================================================
-- EXTENSÃO
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM: UnifyCard Payment Method Type (CANÔNICO)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'unifycard_method_type'
  ) THEN
    CREATE TYPE unifycard_method_type AS ENUM (
      'credit',            -- Crédito
      'debit',             -- Débito
      'pix',               -- Pix
      'cash',              -- Dinheiro
      'vale_refeicao',     -- Vale Refeição
      'vale_alimentacao'   -- Vale Alimentação
    );
  END IF;
END;
$$;

-- ============================================================
-- TABELA: unifycard_payment_methods
-- ============================================================

CREATE TABLE IF NOT EXISTS unifycard_payment_methods (
    -- Identificação
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    tenant_id UUID NOT NULL
        REFERENCES tenants(id) ON DELETE CASCADE,

    -- Tipo de método
    method_type unifycard_method_type NOT NULL,

    -- Provider (sempre UNIFYCARD)
    provider VARCHAR(50) NOT NULL DEFAULT 'UNIFYCARD',

    -- Taxa percentual (ex: 0.0299 = 2.99%)
    fee_percentage NUMERIC(5,4) NOT NULL DEFAULT 0,

    -- Dias para liquidação (0 = imediato)
    settlement_delay_days INTEGER NOT NULL DEFAULT 0
        CHECK (settlement_delay_days >= 0),

    -- Metadados
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Auditoria
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Unicidade
    CONSTRAINT unifycard_methods_unique_per_tenant_type
      UNIQUE (tenant_id, method_type)
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_unifycard_methods_tenant
    ON unifycard_payment_methods (tenant_id);

CREATE INDEX IF NOT EXISTS idx_unifycard_methods_type
    ON unifycard_payment_methods (tenant_id, method_type);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE unifycard_payment_methods ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'unifycard_payment_methods'
      AND policyname = 'unifycard_methods_tenant_isolation'
  ) THEN
    CREATE POLICY unifycard_methods_tenant_isolation
      ON unifycard_payment_methods
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END;
$$;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================

COMMENT ON TABLE unifycard_payment_methods IS
  'Métodos de pagamento UnifyCard com taxas regionais. Nenhuma integração real; apenas modelagem.';

COMMENT ON COLUMN unifycard_payment_methods.method_type IS
  'Tipo do método: credit, debit, pix, cash, vale_refeicao, vale_alimentacao';

COMMENT ON COLUMN unifycard_payment_methods.fee_percentage IS
  'Taxa percentual (ex: 0.0299 = 2.99%)';

COMMENT ON COLUMN unifycard_payment_methods.settlement_delay_days IS
  'Dias para liquidação (0 = imediato)';

COMMIT;
