-- ============================================================
-- GENESIS 0003: BANK CORE (SSOT FINANCEIRO)
-- ============================================================
-- SSOT: bank_accounts, bank_transactions, bank_ledger, bank_splits
-- MODO: Constitucional Rígido

BEGIN;

-- ============================================================
-- ENUMs
-- ============================================================

CREATE TYPE credit_status AS ENUM ('active', 'inactive', 'expired', 'orphan');

CREATE TYPE transfer_purpose AS ENUM (
  'donation', 'reallocation', 'refund', 'split', 'execution',
  'settlement', 'expiration', 'initial_credit', 'group_allocation',
  'escrow_hold', 'escrow_release'
);

-- ============================================================
-- TABELAS PRINCIPAIS
-- ============================================================

CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID REFERENCES actors(id),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('actor', 'system', 'escrow')),
  owner_id TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'credit',
  credit_status credit_status DEFAULT 'active',
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  inactive_since TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, owner_type, owner_id)
);

CREATE INDEX idx_bank_accounts_tenant ON bank_accounts(tenant_id);
CREATE INDEX idx_bank_accounts_actor ON bank_accounts(actor_id);
CREATE INDEX idx_bank_accounts_status ON bank_accounts(credit_status);

CREATE TABLE bank_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  actor_id UUID NOT NULL REFERENCES actors(id),
  account_id UUID NOT NULL REFERENCES bank_accounts(id),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  purpose transfer_purpose NOT NULL,
  justification TEXT,
  requires_justification BOOLEAN DEFAULT true,
  reference_type TEXT,
  reference_id UUID,
  internal_completed_at TIMESTAMPTZ,
  external_settled_at TIMESTAMPTZ,
  external_partner TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_transactions_tenant ON bank_transactions(tenant_id);
CREATE INDEX idx_bank_transactions_actor ON bank_transactions(actor_id);
CREATE INDEX idx_bank_transactions_account ON bank_transactions(account_id);
CREATE INDEX idx_bank_transactions_purpose ON bank_transactions(purpose);
CREATE INDEX idx_bank_transactions_created ON bank_transactions(created_at);

CREATE TABLE bank_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  account_id UUID NOT NULL REFERENCES bank_accounts(id),
  transaction_id UUID REFERENCES bank_transactions(id),
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  purpose transfer_purpose,
  justification TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_ledger_account ON bank_ledger(account_id);
CREATE INDEX idx_bank_ledger_transaction ON bank_ledger(transaction_id);
CREATE INDEX idx_bank_ledger_created ON bank_ledger(created_at);

CREATE TABLE bank_splits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  transaction_id UUID NOT NULL REFERENCES bank_transactions(id),
  source_actor_id UUID NOT NULL REFERENCES actors(id),
  target_actor_id UUID NOT NULL REFERENCES actors(id),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  split_type TEXT NOT NULL,
  percentage NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_splits_transaction ON bank_splits(transaction_id);
CREATE INDEX idx_bank_splits_source ON bank_splits(source_actor_id);
CREATE INDEX idx_bank_splits_target ON bank_splits(target_actor_id);

-- ============================================================
-- VIEW: System Coverage
-- ============================================================

CREATE OR REPLACE VIEW system_coverage AS
SELECT 
  t.id as tenant_id,
  COALESCE((
    SELECT SUM(CASE WHEN bl.direction = 'credit' THEN bl.amount_cents ELSE -bl.amount_cents END)
    FROM bank_accounts ba
    JOIN bank_ledger bl ON bl.account_id = ba.id
    WHERE ba.tenant_id = t.id AND ba.owner_type = 'system'
  ), 0) as execution_capacity_cents,
  COALESCE((
    SELECT SUM(CASE WHEN bl.direction = 'credit' THEN bl.amount_cents ELSE -bl.amount_cents END)
    FROM bank_accounts ba
    JOIN bank_ledger bl ON bl.account_id = ba.id
    WHERE ba.tenant_id = t.id AND ba.owner_type != 'system'
  ), 0) as total_credits_cents
FROM tenants t;

-- ============================================================
-- TRIGGER: Coverage Check
-- ============================================================

CREATE OR REPLACE FUNCTION check_coverage_before_credit()
RETURNS TRIGGER AS $$
DECLARE
  v_coverage NUMERIC;
  v_owner_type TEXT;
  v_capacity BIGINT;
  v_credits BIGINT;
BEGIN
  IF NEW.direction != 'credit' THEN RETURN NEW; END IF;
  
  SELECT ba.owner_type INTO v_owner_type 
  FROM bank_accounts ba 
  WHERE ba.id = NEW.account_id;

  IF v_owner_type = 'system' THEN RETURN NEW; END IF;
  
  SELECT execution_capacity_cents, total_credits_cents 
  INTO v_capacity, v_credits
  FROM system_coverage 
  WHERE tenant_id = NEW.tenant_id;
  
  IF v_capacity > 0 THEN
    v_coverage := (v_credits::NUMERIC / v_capacity::NUMERIC) * 100;
  ELSE
    v_coverage := 100;
  END IF;
  
  IF v_coverage >= 80 THEN
    RAISE EXCEPTION 'COVERAGE_EXCEEDED: % cobertura', ROUND(v_coverage, 2)
      USING ERRCODE = 'P0001';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_coverage
  BEFORE INSERT ON bank_ledger
  FOR EACH ROW EXECUTE FUNCTION check_coverage_before_credit();

-- ============================================================
-- ATL CHECK
-- ============================================================

CREATE OR REPLACE FUNCTION check_atl_before_transaction()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM atl_blocked_actors 
    WHERE actor_id = NEW.actor_id
  ) THEN
    RAISE EXCEPTION 'ATL_BLOCKED' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_atl
  BEFORE INSERT ON bank_transactions
  FOR EACH ROW EXECUTE FUNCTION check_atl_before_transaction();

-- ============================================================
-- PURPOSE VALIDATION
-- ============================================================

CREATE OR REPLACE FUNCTION validate_transfer_purpose()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.purpose IS NULL THEN
    RAISE EXCEPTION 'MISSING_PURPOSE' USING ERRCODE = 'P0001';
  END IF;
  
  IF NEW.requires_justification = true 
     AND NEW.purpose IN ('reallocation', 'refund', 'execution')
     AND (NEW.justification IS NULL OR LENGTH(TRIM(NEW.justification)) < 10) THEN
    RAISE EXCEPTION 'MISSING_JUSTIFICATION' USING ERRCODE = 'P0001';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_purpose
  BEFORE INSERT ON bank_transactions
  FOR EACH ROW EXECUTE FUNCTION validate_transfer_purpose();

-- ============================================================
-- UPDATE ACTIVITY
-- ============================================================

CREATE OR REPLACE FUNCTION update_account_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE bank_accounts 
  SET last_activity_at = now(),
      inactive_since = NULL,
      credit_status = 'active'
  WHERE id = NEW.account_id 
    AND owner_type != 'system';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_activity
  AFTER INSERT ON bank_ledger
  FOR EACH ROW EXECUTE FUNCTION update_account_activity();

-- ============================================================
-- AUX TABLES
-- ============================================================

CREATE TABLE execution_fund_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) UNIQUE,
  max_percentage_of_reserve INTEGER NOT NULL DEFAULT 20,
  allowed_uses TEXT[] NOT NULL DEFAULT ARRAY['execution','stabilization','collective_impact'],
  prohibited_uses TEXT[] NOT NULL DEFAULT ARRAY['distribution','profit','operations'],
  requires_committee_approval_above_cents BIGINT DEFAULT 1000000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE execution_fund_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  movement_type TEXT NOT NULL CHECK (
    movement_type IN ('credit_expiration','orphan_recovery','execution','stabilization')
  ),
  amount_cents BIGINT NOT NULL,
  source_account_id UUID REFERENCES bank_accounts(id),
  source_description TEXT,
  approved_by_user_id UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_execution_fund_movements_tenant 
  ON execution_fund_movements(tenant_id);

CREATE TABLE coverage_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  coverage_pct NUMERIC(5,2) NOT NULL,
  execution_capacity_cents BIGINT NOT NULL,
  total_credits_cents BIGINT NOT NULL,
  operation_blocked BOOLEAN DEFAULT false
);

CREATE INDEX idx_coverage_audit_tenant 
  ON coverage_audit_log(tenant_id);

-- ============================================================
-- AUX FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION mark_inactive_accounts() 
RETURNS INTEGER AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE bank_accounts
  SET credit_status = 'inactive',
      inactive_since = now()
  WHERE credit_status = 'active'
    AND owner_type != 'system'
    AND last_activity_at < now() - interval '12 months';
    
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION expire_old_credits() 
RETURNS INTEGER AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE bank_accounts
  SET credit_status = 'expired',
      expires_at = now()
  WHERE credit_status = 'inactive'
    AND inactive_since < now() - interval '12 months'
    AND owner_type != 'system';
    
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMIT;
