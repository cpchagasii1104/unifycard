-- Migration 109: Criar tabela ledger_referral_splits
-- Data: 2025-01-02
-- Autor: Colaboração Claude + ChatGPT
-- Propósito: Registrar distribuições de split para indicadores

-- ============================================================================
-- REGRA DE NEGÓCIO:
-- Quando usuário B (indicado por A) gera lucro, A recebe % de comissão.
-- Esta tabela registra cada crédito de comissão para auditoria.
--
-- Cadastro cria identidade.
-- Uso cria valor.
-- Valor cria split.
-- ============================================================================

-- 1. Criar tabela de splits
CREATE TABLE IF NOT EXISTS ledger_referral_splits (
  -- PK
  split_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  
  -- Referência ao evento de lucro que gerou este split
  profit_event_id UUID NOT NULL,
  
  -- Transação original (serviço, venda, ingresso, etc)
  original_transaction_id UUID NOT NULL,
  
  -- Quem gerou o lucro (referred)
  source_user_id UUID NOT NULL REFERENCES users(user_id),
  
  -- Quem recebe a comissão (referrer)
  beneficiary_user_id UUID NOT NULL REFERENCES users(user_id),
  
  -- Vínculo de indicação usado (auditoria)
  referral_link_id UUID,
  
  -- Valor original da transação (centavos)
  original_amount_cents INTEGER NOT NULL,
  
  -- Percentual aplicado (basis points: 100 = 1%)
  percentage_bps INTEGER NOT NULL DEFAULT 500, -- 5% default
  
  -- Valor do split (centavos)
  split_amount_cents INTEGER NOT NULL,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending',    -- Aguardando processamento
    'credited',   -- Creditado na conta do beneficiário
    'failed',     -- Falhou
    'reversed'    -- Estornado
  )),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  credited_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata (razão do split, tipo de transação, etc)
  metadata JSONB DEFAULT '{}'
);

-- 2. Índices para performance
-- Por tenant (RLS)
CREATE INDEX IF NOT EXISTS ledger_referral_splits_tenant_idx 
ON ledger_referral_splits(tenant_id);

-- Por quem gerou lucro (relatórios)
CREATE INDEX IF NOT EXISTS ledger_referral_splits_source_idx 
ON ledger_referral_splits(source_user_id);

-- Por quem recebe comissão (dashboard do indicador)
CREATE INDEX IF NOT EXISTS ledger_referral_splits_beneficiary_idx 
ON ledger_referral_splits(beneficiary_user_id);

-- Por status (processamento batch)
CREATE INDEX IF NOT EXISTS ledger_referral_splits_status_idx 
ON ledger_referral_splits(status);

-- Por transação (auditoria)
CREATE INDEX IF NOT EXISTS ledger_referral_splits_transaction_idx 
ON ledger_referral_splits(original_transaction_id);

-- 3. Row Level Security
ALTER TABLE ledger_referral_splits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'ledger_referral_splits'
      AND policyname = 'ledger_referral_splits_rls'
  ) THEN
    CREATE POLICY ledger_referral_splits_rls ON ledger_referral_splits
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- 4. Comentários para documentação
COMMENT ON TABLE ledger_referral_splits IS 
  'Registro de splits de comissão para indicadores. Auditável e imutável após criação.';

COMMENT ON COLUMN ledger_referral_splits.percentage_bps IS 
  'Percentual em basis points (500 = 5%). Configurável por tipo de transação.';

COMMENT ON COLUMN ledger_referral_splits.split_amount_cents IS 
  'Valor calculado: original_amount_cents * percentage_bps / 10000';

COMMENT ON COLUMN ledger_referral_splits.status IS 
  'pending=aguardando, credited=pago, failed=erro, reversed=estornado';

-- ============================================================================
-- EXEMPLO DE USO:
--
-- Usuário B (indicado por A) paga R$ 100,00 por um serviço.
-- Split de 5% = R$ 5,00 vai para A.
--
-- INSERT INTO ledger_referral_splits (
--   tenant_id, profit_event_id, original_transaction_id,
--   source_user_id, beneficiary_user_id, referral_link_id,
--   original_amount_cents, percentage_bps, split_amount_cents
-- ) VALUES (
--   $tenant, $tx_id, $tx_id,
--   $user_b, $user_a, $link_id,
--   10000, 500, 500
-- );
-- ============================================================================
