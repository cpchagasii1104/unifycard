-- ============================================================
-- UNIFICARD — MIGRATION 062
-- Arquivo: 062_regional_fund_governance_atomic_execution.sql
-- Tipo: PATCH CRÍTICO (atomicidade e idempotência financeira)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- A migration 061 introduziu a governança do Fundo Regional,
-- incluindo propostas financeiras e votação.
--
-- Durante a execução financeira de uma proposta aprovada,
-- é necessário garantir:
-- • atomicidade
-- • idempotência
-- • proteção contra execução duplicada
-- • proteção contra race conditions
--
-- OBJETIVO
-- • Introduzir estado transitório EXECUTING
-- • Permitir retry seguro via execution_transaction_id
-- • Garantir que uma proposta só execute uma vez
--
-- MODELO DE EXECUÇÃO
-- • EXECUTED   → execução concluída com sucesso
-- • EXECUTING  → execução em andamento (lock lógico)
--
-- REGRAS IMPORTANTES
-- • execution_transaction_id identifica a execução
-- • Deve ser único por tenant/proposta
-- • executing_at marca início da execução
-- • O banco NÃO valida ordem de transição de status
-- • A máquina de estados vive na aplicação
--
-- ESCOPO
-- ✔ Adiciona colunas de execução
-- ✔ Atualiza CHECK constraint de status
-- ✔ Cria índices de idempotência
--
-- ❌ Não executa transações financeiras
-- ❌ Não altera lógica de votação
--
-- DEPENDÊNCIAS
-- • regional_fund_proposals (migration 061)
--
-- IDEMPOTÊNCIA
-- • Todas as alterações usam IF NOT EXISTS ou guards
--
-- ============================================================


-- ============================================================
-- 1) COLUNAS PARA EXECUÇÃO ATÔMICA
-- ============================================================

ALTER TABLE regional_fund_proposals
ADD COLUMN IF NOT EXISTS execution_transaction_id UUID,
ADD COLUMN IF NOT EXISTS executing_at TIMESTAMPTZ;


-- ============================================================
-- 2) ATUALIZAR CHECK CONSTRAINT DE STATUS
-- ============================================================

-- Remover qualquer CHECK constraint existente sobre status
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'regional_fund_proposals'::regclass
      AND contype = 'c'
  LOOP
    EXECUTE format(
      'ALTER TABLE regional_fund_proposals DROP CONSTRAINT %I',
      r.conname
    );
  END LOOP;
END $$;

-- Adicionar constraint atualizada
ALTER TABLE regional_fund_proposals
ADD CONSTRAINT regional_fund_proposals_status_check
CHECK (
  status IN (
    'DRAFT',
    'OPEN',
    'CLOSED',
    'EXECUTING',
    'EXECUTED',
    'REJECTED'
  )
);


-- ============================================================
-- 3) IDEMPOTÊNCIA E LOCK LÓGICO
-- ============================================================

-- Garante que uma transação de execução não seja aplicada duas vezes
CREATE UNIQUE INDEX IF NOT EXISTS idx_regional_fund_execution_tx_id
ON regional_fund_proposals (execution_transaction_id)
WHERE execution_transaction_id IS NOT NULL;

-- Permite identificar rapidamente propostas em execução
CREATE INDEX IF NOT EXISTS idx_regional_fund_executing
ON regional_fund_proposals (executing_at)
WHERE status = 'EXECUTING';


-- ============================================================
-- 4) COMENTÁRIOS
-- ============================================================

COMMENT ON COLUMN regional_fund_proposals.execution_transaction_id IS
  'Identificador único da execução financeira (idempotência e retry seguro)';

COMMENT ON COLUMN regional_fund_proposals.executing_at IS
  'Timestamp de início da execução (lock lógico contra race conditions)';


-- ============================================================
-- FIM 062_regional_fund_governance_atomic_execution.sql
-- ============================================================

















