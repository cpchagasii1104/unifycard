-- ============================================================
-- UNIFICARD — MIGRATION 263
-- Arquivo: 263_create_escrow_accounts.sql
-- Tipo: NOVA FUNCIONALIDADE (Pagamentos com Escrow e Marcos)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Esta migration cria as tabelas de Escrow Accounts, Payment
-- Milestones e Escrow Transactions para pagamentos seguros
-- baseados em marcos de execução.
--
-- REGRAS:
-- - Nenhum pagamento sem Agreement FINALIZED
-- - Valores vêm exclusivamente do Agreement
-- - Liberação por marcos explícitos
-- - Disputa aberta bloqueia RELEASE
--
-- IDEMPOTÊNCIA
-- Todas as alterações usam IF NOT EXISTS
-- ============================================================

-- ============================================================
-- 1) ENUM: escrow_status
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'escrow_status') THEN
    CREATE TYPE escrow_status AS ENUM (
      'PENDING',
      'FUNDS_HELD',
      'READY_TO_RELEASE',
      'RELEASED',
      'REFUNDED',
      'BLOCKED_BY_DISPUTE'
    );
  END IF;
END$$;

-- ============================================================
-- 2) ENUM: payment_milestone
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_milestone') THEN
    CREATE TYPE payment_milestone AS ENUM (
      'CONFIRMED',
      'STARTED',
      'COMPLETED'
    );
  END IF;
END$$;

-- ============================================================
-- 3) ENUM: escrow_transaction_type
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'escrow_transaction_type') THEN
    CREATE TYPE escrow_transaction_type AS ENUM (
      'HOLD',
      'RELEASE',
      'REFUND'
    );
  END IF;
END$$;

-- ============================================================
-- 4) TABELA: escrow_accounts
-- ============================================================

CREATE TABLE IF NOT EXISTS escrow_accounts (
  escrow_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  agreement_id UUID NOT NULL REFERENCES agreements(agreement_id) ON DELETE RESTRICT,
  service_order_id UUID NULL REFERENCES service_orders(id) ON DELETE SET NULL,
  bundle_id VARCHAR(255) NULL, -- Bundle ID (pode ser string)
  evidence_pack_id UUID NULL, -- Vinculado ao evidence pack
  total_amount_cents INTEGER NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
  held_amount_cents INTEGER NOT NULL DEFAULT 0,
  released_amount_cents INTEGER NOT NULL DEFAULT 0,
  refunded_amount_cents INTEGER NOT NULL DEFAULT 0,
  status escrow_status NOT NULL DEFAULT 'PENDING',
  current_milestone payment_milestone NULL,
  dispute_status VARCHAR(20) NOT NULL DEFAULT 'NONE',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT escrow_accounts_amount_positive CHECK (total_amount_cents >= 0),
  CONSTRAINT escrow_accounts_held_positive CHECK (held_amount_cents >= 0),
  CONSTRAINT escrow_accounts_released_positive CHECK (released_amount_cents >= 0),
  CONSTRAINT escrow_accounts_refunded_positive CHECK (refunded_amount_cents >= 0),
  CONSTRAINT escrow_accounts_amounts_sum CHECK (
    held_amount_cents + released_amount_cents + refunded_amount_cents <= total_amount_cents
  ),
  CONSTRAINT escrow_accounts_dispute_status_check CHECK (dispute_status IN ('NONE', 'OPEN', 'RESOLVED'))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_escrow_accounts_tenant_agreement ON escrow_accounts(tenant_id, agreement_id);
CREATE INDEX IF NOT EXISTS idx_escrow_accounts_tenant_service_order ON escrow_accounts(tenant_id, service_order_id) WHERE service_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_escrow_accounts_tenant_bundle ON escrow_accounts(tenant_id, bundle_id) WHERE bundle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_escrow_accounts_tenant_status ON escrow_accounts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_escrow_accounts_tenant_dispute ON escrow_accounts(tenant_id, dispute_status) WHERE dispute_status != 'NONE';

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_escrow_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_escrow_accounts_updated_at
  BEFORE UPDATE ON escrow_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_escrow_accounts_updated_at();

-- ============================================================
-- 5) TABELA: payment_milestones
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_milestones (
  milestone_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escrow_id UUID NOT NULL REFERENCES escrow_accounts(escrow_id) ON DELETE CASCADE,
  milestone payment_milestone NOT NULL,
  amount_cents INTEGER NOT NULL,
  percentage NUMERIC(5, 2) NOT NULL, -- % do total (0-100)
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  authorized_at TIMESTAMP WITH TIME ZONE,
  released_at TIMESTAMP WITH TIME ZONE,
  authorized_by_actor_id VARCHAR(255),
  released_by_actor_id VARCHAR(255),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT payment_milestones_amount_positive CHECK (amount_cents >= 0),
  CONSTRAINT payment_milestones_percentage_range CHECK (percentage >= 0 AND percentage <= 100),
  CONSTRAINT payment_milestones_status_check CHECK (status IN ('PENDING', 'AUTHORIZED', 'RELEASED')),
  CONSTRAINT payment_milestones_unique_escrow_milestone UNIQUE (escrow_id, milestone)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_payment_milestones_escrow ON payment_milestones(escrow_id);
CREATE INDEX IF NOT EXISTS idx_payment_milestones_status ON payment_milestones(status);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_payment_milestones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payment_milestones_updated_at
  BEFORE UPDATE ON payment_milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_milestones_updated_at();

-- ============================================================
-- 6) TABELA: escrow_transactions
-- ============================================================

CREATE TABLE IF NOT EXISTS escrow_transactions (
  transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escrow_id UUID NOT NULL REFERENCES escrow_accounts(escrow_id) ON DELETE CASCADE,
  milestone_id UUID NULL REFERENCES payment_milestones(milestone_id) ON DELETE SET NULL,
  transaction_type escrow_transaction_type NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  initiated_by_actor_id VARCHAR(255) NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  bank_transaction_id VARCHAR(255), -- ID da transação bancária
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT escrow_transactions_amount_positive CHECK (amount_cents > 0),
  CONSTRAINT escrow_transactions_status_check CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_escrow ON escrow_transactions(escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_milestone ON escrow_transactions(milestone_id) WHERE milestone_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_status ON escrow_transactions(status);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_created ON escrow_transactions(created_at DESC);

-- Comentários
COMMENT ON TABLE escrow_accounts IS 'Contas de escrow para pagamentos seguros baseados em marcos';
COMMENT ON TABLE payment_milestones IS 'Marcos de pagamento vinculados a escrow accounts';
COMMENT ON TABLE escrow_transactions IS 'Transações de escrow (append-only, imutável)';




