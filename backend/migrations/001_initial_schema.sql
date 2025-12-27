-- ================================================
-- UNIFICARD - MIGRATION 001 (VERSÃO FINAL)
-- Multi-tenant schema + RLS + accounts + ledger + event_log V5
-- ================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================
-- TENANTS
-- ===========================
CREATE TABLE tenants (
  tenant_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- ===========================
-- USERS
-- ===========================
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(tenant_id, email)
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_rls ON users
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ===========================
-- PROFILES
-- ===========================
CREATE TABLE profiles (
  profile_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  user_id UUID NOT NULL REFERENCES users(user_id),
  full_name VARCHAR(255),
  phone VARCHAR(50),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profile_rls ON profiles
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ===========================
-- ACCOUNTS
-- ===========================
CREATE TABLE accounts (
  account_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  owner_id UUID NOT NULL,
  owner_type VARCHAR(50) NOT NULL CHECK (
    owner_type IN ('user','merchant','community_fund','platform_ops','group')
  ),
  balance NUMERIC(20,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'BRL',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY accounts_rls ON accounts
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ===========================
-- TRANSACTIONS
-- ===========================
CREATE TABLE transactions (
  transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  from_account UUID NOT NULL REFERENCES accounts(account_id),
  to_account UUID NOT NULL REFERENCES accounts(account_id),
  amount NUMERIC(20,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) DEFAULT 'BRL',
  event_id UUID NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT now(),
  settled_at TIMESTAMP
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY transactions_rls ON transactions
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ===========================
-- LEDGER (IMUTÁVEL)
-- ===========================
CREATE TABLE ledger (
  entry_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  account_id UUID NOT NULL REFERENCES accounts(account_id),
  transaction_id UUID NOT NULL REFERENCES transactions(transaction_id),
  entry_type VARCHAR(10) NOT NULL CHECK(entry_type IN ('credit','debit')),
  amount NUMERIC(20,2) NOT NULL,
  balance_before NUMERIC(20,2) NOT NULL,
  balance_after NUMERIC(20,2) NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

ALTER TABLE ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY ledger_rls ON ledger
  USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ===========================
-- EVENT LOG (VERSÃO FINAL V5)
-- ===========================
CREATE TABLE event_log (
  event_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  event_type VARCHAR(255) NOT NULL,
  event_version INTEGER DEFAULT 1,
  payload JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT now()
);

ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_log_rls ON event_log
  USING (tenant_id::text = current_setting('app.current_tenant', true));

CREATE INDEX idx_eventlog_processing ON event_log(processed, created_at);
