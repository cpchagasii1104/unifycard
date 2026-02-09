/*
Arquivo: 011_unifybank_ssot.sql
Projeto: UnifiCard
Banco: PostgreSQL 14+
Escopo: Núcleo financeiro SSOT (Unify Bank)

REGRAS:
- ÚNICA fonte da verdade financeira
- Ledger append-only
- Dinheiro em centavos (BIGINT)
- Nenhum saldo primário fora do ledger
*/

BEGIN;

-- ============================================================
-- BANK ACCOUNTS
-- ============================================================

CREATE TABLE bank_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id      UUID NOT NULL REFERENCES actors(id) ON DELETE RESTRICT,
  currency      TEXT NOT NULL CHECK (currency IN ('BRL','USD','EUR','TEST')),
  status        TEXT NOT NULL CHECK (status IN ('active','blocked','closed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  version       INTEGER NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, actor_id, currency)
);

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_accounts_rls ON bank_accounts
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE INDEX idx_bank_accounts_tenant_actor
  ON bank_accounts (tenant_id, actor_id);

-- ============================================================
-- BANK TRANSACTIONS
-- ============================================================

CREATE TABLE bank_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id          UUID NOT NULL UNIQUE,
  transaction_type  TEXT NOT NULL CHECK (
    transaction_type IN (
      'transfer','deposit','withdrawal','reversal',
      'fee','split','escrow','release'
    )
  ),
  original_transaction_id UUID
    REFERENCES bank_transactions(id) ON DELETE SET NULL,
  status            TEXT NOT NULL CHECK (
    status IN ('pending','completed','failed','reversed')
  ),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at        TIMESTAMPTZ
);

ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_transactions_rls ON bank_transactions
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE INDEX idx_bank_transactions_tenant_created
  ON bank_transactions (tenant_id, created_at DESC);

-- ============================================================
-- BANK LEDGER (APPEND-ONLY)
-- ============================================================

CREATE TABLE bank_ledger (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bank_account_id       UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
  bank_transaction_id   UUID NOT NULL UNIQUE
    REFERENCES bank_transactions(id) ON DELETE RESTRICT,
  direction             TEXT NOT NULL CHECK (direction IN ('credit','debit')),
  amount_cents          BIGINT NOT NULL CHECK (amount_cents > 0),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bank_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_ledger_rls ON bank_ledger
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE INDEX idx_bank_ledger_account_created
  ON bank_ledger (bank_account_id, created_at DESC);

-- Proteção de imutabilidade
CREATE OR REPLACE FUNCTION prevent_bank_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'bank_ledger is append-only. UPDATE and DELETE are forbidden.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_bank_ledger_update
  BEFORE UPDATE ON bank_ledger
  FOR EACH ROW EXECUTE FUNCTION prevent_bank_ledger_mutation();

CREATE TRIGGER prevent_bank_ledger_delete
  BEFORE DELETE ON bank_ledger
  FOR EACH ROW EXECUTE FUNCTION prevent_bank_ledger_mutation();

-- ============================================================
-- BANK SPLITS
-- ============================================================

CREATE TABLE bank_splits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bank_ledger_id  UUID NOT NULL REFERENCES bank_ledger(id) ON DELETE RESTRICT,
  target_actor_id UUID NOT NULL REFERENCES actors(id) ON DELETE RESTRICT,
  amount_cents    BIGINT NOT NULL CHECK (amount_cents > 0),
  split_type      TEXT NOT NULL CHECK (
    split_type IN (
      'fee','regional_fund','reserve',
      'escrow','revenue_share','referral'
    )
  ),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bank_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_splits_rls ON bank_splits
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE INDEX idx_bank_splits_ledger
  ON bank_splits (bank_ledger_id);

COMMIT;
