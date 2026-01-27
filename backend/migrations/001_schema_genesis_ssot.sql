BEGIN;

-- =========================
-- CORE IDENTITY (MINIMAL)
-- =========================

CREATE TABLE actors (
  id         UUID PRIMARY KEY,
  type       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- BANK — SSOT FINANCEIRO
-- =========================

CREATE TABLE bank_accounts (
  id         UUID PRIMARY KEY,
  actor_id   UUID NOT NULL REFERENCES actors(id),
  currency   TEXT NOT NULL,
  status     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bank_transactions (
  id         UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES bank_accounts(id),
  type       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bank_ledger (
  id             UUID PRIMARY KEY,
  account_id     UUID NOT NULL REFERENCES bank_accounts(id),
  transaction_id UUID NOT NULL UNIQUE REFERENCES bank_transactions(id),
  amount         NUMERIC NOT NULL CHECK (amount > 0),
  direction      TEXT NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bank_splits (
  id              UUID PRIMARY KEY,
  ledger_id       UUID NOT NULL REFERENCES bank_ledger(id),
  target_actor_id UUID NOT NULL REFERENCES actors(id),
  amount          NUMERIC NOT NULL CHECK (amount > 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;