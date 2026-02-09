/*
Arquivo: 010_schema_genesis_ssot.sql
Projeto: UnifiCard
Banco: PostgreSQL 14+
Escopo: Core multi-tenant + SSOT financeiro

Este arquivo é o ÚNICO baseline válido do sistema.
Nenhuma estrutura legacy é criada aqui.
*/

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================
-- TENANTS
-- =========================

CREATE TABLE tenants (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- ACTORS (IDENTIDADE CANÔNICA)
-- =========================

CREATE TABLE actors (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  actor_type  TEXT NOT NULL CHECK (actor_type IN ('user','company','group','system')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  version     INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE actors ENABLE ROW LEVEL SECURITY;

CREATE POLICY actors_rls ON actors
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- =========================
-- USERS (PERFIL HUMANO)
-- =========================

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  actor_id      UUID NOT NULL UNIQUE REFERENCES actors(id),
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  version       INTEGER NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, email)
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_rls ON users
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- =========================
-- PROFILES
-- =========================

CREATE TABLE profiles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  full_name   TEXT,
  phone       TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  version     INTEGER NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, user_id)
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_rls ON profiles
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- =========================
-- BANK ACCOUNTS (SSOT)
-- =========================

CREATE TABLE bank_accounts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  actor_id    UUID NOT NULL REFERENCES actors(id),
  currency    TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('active','blocked','closed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  version     INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_accounts_rls ON bank_accounts
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- =========================
-- BANK TRANSACTIONS
-- =========================

CREATE TABLE bank_transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  account_id  UUID NOT NULL REFERENCES bank_accounts(id),
  type        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_transactions_rls ON bank_transactions
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- =========================
-- BANK LEDGER (SALDO DERIVADO)
-- =========================

CREATE TABLE bank_ledger (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id),
  account_id           UUID NOT NULL REFERENCES bank_accounts(id),
  bank_transaction_id  UUID NOT NULL UNIQUE REFERENCES bank_transactions(id),
  amount_cents         BIGINT NOT NULL CHECK (amount_cents > 0),
  direction            TEXT NOT NULL CHECK (direction IN ('credit','debit')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bank_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_ledger_rls ON bank_ledger
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- =========================
-- BANK SPLITS
-- =========================

CREATE TABLE bank_splits (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  ledger_id        UUID NOT NULL REFERENCES bank_ledger(id),
  target_actor_id  UUID NOT NULL REFERENCES actors(id),
  amount_cents     BIGINT NOT NULL CHECK (amount_cents > 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bank_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_splits_rls ON bank_splits
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- =========================
-- EVENT LOG
-- =========================

CREATE TABLE event_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id),
  event_type   TEXT NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1,
  payload      JSONB NOT NULL,
  metadata     JSONB NOT NULL DEFAULT '{}',
  processed    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_log_rls ON event_log
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE INDEX idx_event_log_processing
  ON event_log (processed, created_at);

COMMIT;
