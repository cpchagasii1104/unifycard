-- ================================================
-- MIGRATION 062: REGIONAL FUND GOVERNANCE PATCH
-- FASE 8.1: Patch crítico - atomicidade e idempotência
-- ================================================

-- Adicionar colunas para execução atômica e idempotência
ALTER TABLE regional_fund_proposals
ADD COLUMN IF NOT EXISTS execution_transaction_id UUID NULL,
ADD COLUMN IF NOT EXISTS executing_at TIMESTAMPTZ NULL;

-- Adicionar status EXECUTING ao CHECK constraint
ALTER TABLE regional_fund_proposals
DROP CONSTRAINT IF EXISTS regional_fund_proposals_status_check;

ALTER TABLE regional_fund_proposals
ADD CONSTRAINT regional_fund_proposals_status_check
CHECK (status IN ('DRAFT', 'OPEN', 'CLOSED', 'EXECUTING', 'EXECUTED', 'REJECTED'));

-- Índice único para execution_transaction_id (garantir idempotência)
CREATE UNIQUE INDEX IF NOT EXISTS idx_regional_fund_proposals_execution_tx_id
ON regional_fund_proposals(execution_transaction_id)
WHERE execution_transaction_id IS NOT NULL;

-- Índice para busca rápida de propostas em execução
CREATE INDEX IF NOT EXISTS idx_regional_fund_proposals_executing
ON regional_fund_proposals(executing_at)
WHERE status = 'EXECUTING';

-- Comentários
COMMENT ON COLUMN regional_fund_proposals.execution_transaction_id IS 'ID da transação de execução (para idempotência)';
COMMENT ON COLUMN regional_fund_proposals.executing_at IS 'Timestamp de início da execução (para evitar race conditions)';















