-- ============================================================
-- UNIFICARD — MIGRATION 268
-- Arquivo: 268_create_ledger_entries.sql
-- Tipo: NOVA FUNCIONALIDADE (Ledger Contábil Canônico)
-- Banco alvo: PostgreSQL 14+
--
-- REGRAS:
-- - Append-only (sem UPDATE / DELETE)
-- - Double-entry lógico
-- - Valores em centavos (BIGINT)
-- - Evidência obrigatória
-- ============================================================

BEGIN;

-- ============================================================
-- EXTENSÃO
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1) ENUM: ledger_entry_type (CANÔNICO)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'ledger_entry_type'
  ) THEN
    CREATE TYPE ledger_entry_type AS ENUM (
      'escrow_hold',
      'escrow_release',
      'escrow_refund',
      'split_created',
      'commission_fee',
      'payout_requested',
      'payout_executed'
    );
  END IF;
END;
$$;

-- ============================================================
-- 2) TABELA: ledger_entries
-- ============================================================

CREATE TABLE IF NOT EXISTS ledger_entries (
  entry_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(id) ON DELETE CASCADE,

  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  debit_account_id  VARCHAR(255) NOT NULL,
  credit_account_id VARCHAR(255) NOT NULL,

  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'BRL',

  entry_type ledger_entry_type NOT NULL,

  context_type VARCHAR(50) NOT NULL,
  context_id   VARCHAR(255) NOT NULL,

  evidence_pack_id UUID NOT NULL
    REFERENCES evidence_packs(id) ON DELETE RESTRICT,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- APPEND-ONLY ENFORCEMENT
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_ledger_entries_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'ledger_entries is append-only. UPDATE and DELETE are forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ledger_entries_no_update ON ledger_entries;
CREATE TRIGGER trg_ledger_entries_no_update
  BEFORE UPDATE ON ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_entries_mutation();

DROP TRIGGER IF EXISTS trg_ledger_entries_no_delete ON ledger_entries;
CREATE TRIGGER trg_ledger_entries_no_delete
  BEFORE DELETE ON ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_entries_mutation();

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_ledger_entries_tenant_occurred
  ON ledger_entries (tenant_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_tenant_debit
  ON ledger_entries (tenant_id, debit_account_id);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_tenant_credit
  ON ledger_entries (tenant_id, credit_account_id);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_tenant_context
  ON ledger_entries (tenant_id, context_type, context_id);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_tenant_type
  ON ledger_entries (tenant_id, entry_type);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_tenant_evidence
  ON ledger_entries (tenant_id, evidence_pack_id);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_balance
  ON ledger_entries (
    tenant_id,
    debit_account_id,
    credit_account_id,
    occurred_at DESC
  );

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ledger_entries'
      AND policyname = 'ledger_entries_tenant_isolation'
  ) THEN
    CREATE POLICY ledger_entries_tenant_isolation
      ON ledger_entries
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END;
$$;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================

COMMENT ON TABLE ledger_entries IS
  'Ledger contábil canônico (append-only, imutável, auditável)';

COMMENT ON COLUMN ledger_entries.occurred_at IS
  'Timestamp imutável da ocorrência financeira';

COMMENT ON COLUMN ledger_entries.debit_account_id IS
  'Conta que recebe débito (double-entry lógico)';

COMMENT ON COLUMN ledger_entries.credit_account_id IS
  'Conta que recebe crédito (double-entry lógico)';

COMMENT ON COLUMN ledger_entries.amount_cents IS
  'Valor em centavos (sempre positivo)';

COMMENT ON COLUMN ledger_entries.evidence_pack_id IS
  'Evidência obrigatória da movimentação';

COMMENT ON COLUMN ledger_entries.metadata IS
  'Metadados auxiliares: splitIds, escrowId, agreementId, etc.';

-- ============================================================
-- 3) VIEW: ledger_account_balances (DERIVADA)
-- ============================================================

CREATE OR REPLACE VIEW ledger_account_balances AS
SELECT
  tenant_id,
  account_id,
  currency,
  SUM(CASE WHEN direction = 'debit'  THEN amount_cents ELSE 0 END) AS total_debits_cents,
  SUM(CASE WHEN direction = 'credit' THEN amount_cents ELSE 0 END) AS total_credits_cents,
  SUM(CASE WHEN direction = 'credit' THEN amount_cents ELSE -amount_cents END) AS balance_cents,
  COUNT(*) AS entry_count,
  MAX(occurred_at) AS last_entry_at
FROM (
  SELECT
    tenant_id,
    debit_account_id AS account_id,
    currency,
    amount_cents,
    occurred_at,
    'debit'::text AS direction
  FROM ledger_entries

  UNION ALL

  SELECT
    tenant_id,
    credit_account_id AS account_id,
    currency,
    amount_cents,
    occurred_at,
    'credit'::text AS direction
  FROM ledger_entries
) t
GROUP BY tenant_id, account_id, currency;

COMMENT ON VIEW ledger_account_balances IS
  'Saldo calculado por conta (view derivada, nunca persistida)';

COMMIT;
