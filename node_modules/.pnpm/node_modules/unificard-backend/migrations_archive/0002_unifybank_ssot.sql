/*
Arquivo: 011_unifybank_ssot.sql
Projeto: UnifiCard
Banco: PostgreSQL 14+
Escopo: Núcleo financeiro SSOT (Unify Bank)

FUNÇÃO DESTE ARQUIVO:
- HARDENING do SSOT financeiro
- Reforço de regras
- Garantia de append-only
- Índices e proteções

⚠️ NÃO cria tabelas
⚠️ NÃO redefine schema
⚠️ NÃO duplica SSOT
*/

BEGIN;

-- ============================================================
-- BANK ACCOUNTS — HARDENING
-- ============================================================

-- Garantir constraint crítica
ALTER TABLE bank_accounts
  ADD CONSTRAINT uq_bank_accounts_actor_currency
  UNIQUE (tenant_id, actor_id, currency);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_tenant_actor
  ON bank_accounts (tenant_id, actor_id);

-- ============================================================
-- BANK TRANSACTIONS — HARDENING
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_bank_transactions_tenant_created
  ON bank_transactions (tenant_id, created_at DESC);

-- ============================================================
-- BANK LEDGER — APPEND-ONLY ENFORCEMENT
-- ============================================================

-- Trigger de imutabilidade
CREATE OR REPLACE FUNCTION prevent_bank_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'bank_ledger is append-only. UPDATE and DELETE are forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_bank_ledger_update ON bank_ledger;
CREATE TRIGGER prevent_bank_ledger_update
  BEFORE UPDATE ON bank_ledger
  FOR EACH ROW
  EXECUTE FUNCTION prevent_bank_ledger_mutation();

DROP TRIGGER IF EXISTS prevent_bank_ledger_delete ON bank_ledger;
CREATE TRIGGER prevent_bank_ledger_delete
  BEFORE DELETE ON bank_ledger
  FOR EACH ROW
  EXECUTE FUNCTION prevent_bank_ledger_mutation();

CREATE INDEX IF NOT EXISTS idx_bank_ledger_account_created
  ON bank_ledger (account_id, created_at DESC);

-- ============================================================
-- BANK SPLITS — HARDENING
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_bank_splits_ledger
  ON bank_splits (ledger_id);

-- ============================================================
-- RLS — GARANTIA DE ISOLAMENTO (IDEMPOTENTE)
-- ============================================================

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_splits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bank_accounts'
      AND policyname = 'bank_accounts_rls'
  ) THEN
    CREATE POLICY bank_accounts_rls ON bank_accounts
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bank_transactions'
      AND policyname = 'bank_transactions_rls'
  ) THEN
    CREATE POLICY bank_transactions_rls ON bank_transactions
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bank_ledger'
      AND policyname = 'bank_ledger_rls'
  ) THEN
    CREATE POLICY bank_ledger_rls ON bank_ledger
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bank_splits'
      AND policyname = 'bank_splits_rls'
  ) THEN
    CREATE POLICY bank_splits_rls ON bank_splits
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END;
$$;

COMMIT;
