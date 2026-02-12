-- ============================================================
-- UNIFICARD — MIGRATION 124
-- Arquivo: 124_unifywork_financial_links.sql
-- Banco: PostgreSQL 14+
--
-- DOMÍNIO: UnifyWork (Marketplace de Serviços)
-- CAMADA: INTEGRAÇÃO FINANCEIRA (SSOT)
--
-- OBJETIVO
-- - Integrar UnifyWork ao modelo financeiro canônico
-- - Eliminar dependências legacy (transactions)
-- - Garantir rastreabilidade financeira
--
-- REGRAS
-- - NÃO criar tabelas financeiras
-- - NÃO executar movimentação de dinheiro
-- - NÃO criar lógica de split
-- - SOMENTE vínculos estruturais
--
-- DEPENDÊNCIAS
-- - 011_unifybank_ssot.sql
-- - 120_unifywork_core.sql
--
-- ============================================================

BEGIN;

-- ============================================================
-- JOB_ASSIGNMENTS → PAYMENT INTENT
-- ============================================================
-- Cada job_assignment pode gerar UM pedido de pagamento
-- A execução real acontece fora do UnifyWork

ALTER TABLE job_assignments
ADD COLUMN IF NOT EXISTS payment_intent_id UUID;

ALTER TABLE job_assignments
ADD CONSTRAINT fk_job_assignments_payment_intent
FOREIGN KEY (payment_intent_id)
REFERENCES payment_intents(id)
ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_job_assignments_payment_intent
ON job_assignments (tenant_id, payment_intent_id);

COMMENT ON COLUMN job_assignments.payment_intent_id IS
  'Vínculo com pedido de pagamento no sistema financeiro (SSOT)';

-- ============================================================
-- JOB_ASSIGNMENTS → LEDGER (READ-ONLY TRACE)
-- ============================================================
-- Ligação opcional para rastrear lançamentos contábeis
-- Não é usada para cálculo nem execução

ALTER TABLE job_assignments
ADD COLUMN IF NOT EXISTS ledger_entry_id UUID;

ALTER TABLE job_assignments
ADD CONSTRAINT fk_job_assignments_ledger_entry
FOREIGN KEY (ledger_entry_id)
REFERENCES ledger_entries(id)
ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_job_assignments_ledger_entry
ON job_assignments (tenant_id, ledger_entry_id);

COMMENT ON COLUMN job_assignments.ledger_entry_id IS
  'Referência a lançamento contábil associado ao trabalho';

-- ============================================================
-- STATUS FINANCEIRO DERIVADO (NÃO AUTORITATIVO)
-- ============================================================

ALTER TABLE job_assignments
ADD COLUMN IF NOT EXISTS financial_status VARCHAR(50)
CHECK (
  financial_status IN (
    'none',
    'intent_created',
    'authorized',
    'executed',
    'refunded',
    'failed'
  )
) DEFAULT 'none';

COMMENT ON COLUMN job_assignments.financial_status IS
  'Status financeiro derivado a partir do sistema bancário';

COMMIT;
