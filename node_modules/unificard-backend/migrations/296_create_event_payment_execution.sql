-- ============================================================
-- UNIFICARD — EVENT PAYMENT EXECUTION (FASE 6.2)
-- Arquivo: 296_create_event_payment_execution.sql
-- Banco alvo: PostgreSQL 14+
--
-- OBJETIVO
-- Criar tabela para registrar execuções de pagamento de eventos
-- FASE_6_CONTRATO_SPLIT_PAGAMENTO.md
--
-- REGRAS CANÔNICAS:
-- * Execução só pode existir se houver autorização
-- * Execução respeita split declarativo
-- * Execução libera custódia
-- * Execução é explícita, nunca automática
-- * SANDBOX mode obrigatório por enquanto
--
-- ============================================================

BEGIN;

-- ============================================================
-- TABELA: EVENT_PAYMENT_EXECUTION
-- ============================================================

CREATE TABLE IF NOT EXISTS event_payment_execution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Relacionamentos OBRIGATÓRIOS
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  authorization_id UUID NOT NULL REFERENCES event_payment_authorization(id) ON DELETE CASCADE,
  custody_id UUID NOT NULL REFERENCES event_custody(id) ON DELETE CASCADE,
  split_id UUID NOT NULL REFERENCES event_split_declarative(id) ON DELETE CASCADE,
  
  -- Informações Financeiras
  total_amount_cents BIGINT NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
  
  -- Transações do Bank (SANDBOX)
  transaction_ids JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array de IDs de transações
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'executed', -- executed | failed | reversed
  
  -- Timestamps
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  
  -- Nota: FK composta removida - events não tem UNIQUE(tenant_id, id)
  -- A FK simples event_id REFERENCES events(id) já é suficiente
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_event_payment_execution_tenant_event 
  ON event_payment_execution(tenant_id, event_id);

CREATE INDEX IF NOT EXISTS idx_event_payment_execution_authorization 
  ON event_payment_execution(authorization_id);

CREATE INDEX IF NOT EXISTS idx_event_payment_execution_custody 
  ON event_payment_execution(custody_id);

CREATE INDEX IF NOT EXISTS idx_event_payment_execution_split 
  ON event_payment_execution(split_id);

CREATE INDEX IF NOT EXISTS idx_event_payment_execution_executed_at 
  ON event_payment_execution(executed_at);

COMMENT ON TABLE event_payment_execution IS 
  'Registra execuções de pagamento de eventos (FASE 6.2 - SANDBOX)';

COMMENT ON COLUMN event_payment_execution.transaction_ids IS 
  'Array de IDs de transações no bank (SANDBOX mode)';

COMMENT ON COLUMN event_payment_execution.status IS 
  'Status da execução: executed | failed | reversed';

COMMIT;

