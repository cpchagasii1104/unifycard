-- ============================================================
-- UNIFICARD — MIGRATION 268
-- Arquivo: 268_create_ledger_entries.sql
-- Tipo: NOVA FUNCIONALIDADE (Ledger Contábil Canônico)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Esta migration cria a tabela de ledger_entries para registro
-- append-only de todas as movimentações financeiras do sistema.
--
-- REGRAS:
-- - Append-only: sem UPDATE/DELETE
-- - Somas auditáveis
-- - Tudo amarrado a EvidencePack
--
-- IDEMPOTÊNCIA
-- Todas as alterações usam IF NOT EXISTS
-- ============================================================

-- ============================================================
-- 1) ENUM: ledger_entry_type
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ledger_entry_type') THEN
    CREATE TYPE ledger_entry_type AS ENUM (
      'ESCROW_HOLD',
      'ESCROW_RELEASE',
      'ESCROW_REFUND',
      'SPLIT_CREATED',
      'COMMISSION_FEE',
      'PAYOUT_REQUESTED',
      'PAYOUT_EXECUTED'
    );
  END IF;
END$$;

-- ============================================================
-- 2) TABELA: ledger_entries
-- ============================================================

CREATE TABLE IF NOT EXISTS ledger_entries (
  entry_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  debit_account_id VARCHAR(255) NOT NULL, -- Conta que recebe débito
  credit_account_id VARCHAR(255) NOT NULL, -- Conta que recebe crédito
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
  entry_type ledger_entry_type NOT NULL,
  context_type VARCHAR(50) NOT NULL,
  context_id VARCHAR(255) NOT NULL,
  evidence_pack_id UUID NOT NULL REFERENCES evidence_packs(pack_id) ON DELETE RESTRICT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT ledger_entries_amount_positive CHECK (amount_cents > 0),
  CONSTRAINT ledger_entries_evidence_required CHECK (evidence_pack_id IS NOT NULL)
);

-- Índices para performance e consultas
CREATE INDEX IF NOT EXISTS idx_ledger_entries_tenant_timestamp ON ledger_entries(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_tenant_debit_account ON ledger_entries(tenant_id, debit_account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_tenant_credit_account ON ledger_entries(tenant_id, credit_account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_tenant_context ON ledger_entries(tenant_id, context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_tenant_type ON ledger_entries(tenant_id, entry_type);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_tenant_evidence ON ledger_entries(tenant_id, evidence_pack_id);

-- Índice composto para consultas de saldo
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_balance ON ledger_entries(tenant_id, debit_account_id, credit_account_id, timestamp DESC);

-- Comentários
COMMENT ON TABLE ledger_entries IS 'Ledger contábil canônico (append-only, imutável)';
COMMENT ON COLUMN ledger_entries.timestamp IS 'Timestamp imutável da movimentação';
COMMENT ON COLUMN ledger_entries.debit_account_id IS 'Conta que recebe débito (double-entry)';
COMMENT ON COLUMN ledger_entries.credit_account_id IS 'Conta que recebe crédito (double-entry)';
COMMENT ON COLUMN ledger_entries.evidence_pack_id IS 'Obrigatório: sempre deve ter evidência';
COMMENT ON COLUMN ledger_entries.metadata IS 'Metadados: splitIds, escrowId, agreementId, etc.';

-- ============================================================
-- 3) VIEW: ledger_account_balances (calculado, não persistido)
-- ============================================================

CREATE OR REPLACE VIEW ledger_account_balances AS
SELECT
  tenant_id,
  account_id,
  currency,
  SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_cents ELSE 0 END) AS total_debits_cents,
  SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_cents ELSE 0 END) AS total_credits_cents,
  SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_cents ELSE -amount_cents END) AS balance_cents,
  COUNT(*) AS entry_count,
  MAX(timestamp) AS last_entry_at
FROM (
  SELECT tenant_id, debit_account_id AS account_id, currency, amount_cents, timestamp, 'DEBIT' AS entry_type
  FROM ledger_entries
  UNION ALL
  SELECT tenant_id, credit_account_id AS account_id, currency, amount_cents, timestamp, 'CREDIT' AS entry_type
  FROM ledger_entries
) AS all_accounts
GROUP BY tenant_id, account_id, currency;

COMMENT ON VIEW ledger_account_balances IS 'Saldo calculado de contas (não persistido, sempre recalculado)';




