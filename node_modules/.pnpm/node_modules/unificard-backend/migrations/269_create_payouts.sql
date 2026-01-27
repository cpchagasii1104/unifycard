-- ============================================================
-- UNIFICARD — MIGRATION 269
-- Arquivo: 269_create_payouts.sql
-- Tipo: NOVA FUNCIONALIDADE (Payout Engine)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Esta migration cria as tabelas de Payout Batches e Payout Orders
-- para execução financeira controlada baseada no Ledger.
--
-- REGRAS:
-- - Append-only onde aplicável
-- - Constraints para impedir payout duplicado
-- - Tudo amarrado a EvidencePack
--
-- IDEMPOTÊNCIA
-- Todas as alterações usam IF NOT EXISTS
-- ============================================================

-- ============================================================
-- 1) ENUM: payout_status
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_status') THEN
    CREATE TYPE payout_status AS ENUM (
      'PENDING',
      'READY',
      'BLOCKED',
      'EXECUTED',
      'FAILED'
    );
  END IF;
END$$;

-- ============================================================
-- 2) ENUM: payout_method
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_method') THEN
    CREATE TYPE payout_method AS ENUM (
      'MANUAL',
      'BANK_TRANSFER',
      'PIX',
      'FUTURE_PROVIDER'
    );
  END IF;
END$$;

-- ============================================================
-- 3) TABELA: payout_batches
-- ============================================================

CREATE TABLE IF NOT EXISTS payout_batches (
  batch_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  status payout_status NOT NULL DEFAULT 'PENDING',
  total_amount_cents INTEGER NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
  order_count INTEGER NOT NULL DEFAULT 0,
  executed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  blocked_count INTEGER NOT NULL DEFAULT 0,
  evidence_pack_id UUID NOT NULL REFERENCES evidence_packs(pack_id) ON DELETE RESTRICT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT payout_batches_amount_positive CHECK (total_amount_cents >= 0),
  CONSTRAINT payout_batches_counts_valid CHECK (
    order_count >= 0 AND
    executed_count >= 0 AND
    failed_count >= 0 AND
    blocked_count >= 0 AND
    executed_count + failed_count + blocked_count <= order_count
  )
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_payout_batches_tenant_status ON payout_batches(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_payout_batches_tenant_created ON payout_batches(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payout_batches_tenant_evidence ON payout_batches(tenant_id, evidence_pack_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_payout_batches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payout_batches_updated_at
  BEFORE UPDATE ON payout_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_payout_batches_updated_at();

-- ============================================================
-- 4) TABELA: payout_orders
-- ============================================================

CREATE TABLE IF NOT EXISTS payout_orders (
  order_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  batch_id UUID NULL REFERENCES payout_batches(batch_id) ON DELETE SET NULL,
  actor_id VARCHAR(255) NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
  status payout_status NOT NULL DEFAULT 'PENDING',
  payout_method payout_method NOT NULL DEFAULT 'MANUAL',
  ledger_entry_ids TEXT[] NOT NULL DEFAULT '{}', -- Array de IDs de ledger entries
  escrow_id UUID NULL,
  agreement_id UUID NULL,
  evidence_pack_id UUID NOT NULL REFERENCES evidence_packs(pack_id) ON DELETE RESTRICT,
  block_reason TEXT,
  execution_metadata JSONB DEFAULT '{}'::jsonb,
  failure_reason TEXT,
  executed_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT payout_orders_amount_positive CHECK (amount_cents > 0),
  CONSTRAINT payout_orders_ledger_entries_required CHECK (array_length(ledger_entry_ids, 1) > 0),
  CONSTRAINT payout_orders_evidence_required CHECK (evidence_pack_id IS NOT NULL)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_payout_orders_tenant_batch ON payout_orders(tenant_id, batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payout_orders_tenant_actor ON payout_orders(tenant_id, actor_id);
CREATE INDEX IF NOT EXISTS idx_payout_orders_tenant_status ON payout_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_payout_orders_tenant_created ON payout_orders(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payout_orders_tenant_escrow ON payout_orders(tenant_id, escrow_id) WHERE escrow_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payout_orders_tenant_evidence ON payout_orders(tenant_id, evidence_pack_id);

-- Nota: Não é possível criar índice único direto em array
-- A validação de duplicação será feita via código (payoutRepository.isLedgerEntryUsed)
-- Para performance, criamos índice GIN no array
CREATE INDEX IF NOT EXISTS idx_payout_orders_ledger_entry_ids ON payout_orders USING GIN(ledger_entry_ids);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_payout_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payout_orders_updated_at
  BEFORE UPDATE ON payout_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_payout_orders_updated_at();

-- Comentários
COMMENT ON TABLE payout_batches IS 'Lotes de payouts para processamento em batch';
COMMENT ON TABLE payout_orders IS 'Ordens individuais de payout (append-only em eventos)';
COMMENT ON COLUMN payout_orders.ledger_entry_ids IS 'Array de IDs de ledger entries que originam este payout';
COMMENT ON COLUMN payout_orders.evidence_pack_id IS 'Obrigatório: sempre deve ter evidência';
COMMENT ON COLUMN payout_orders.block_reason IS 'Motivo do bloqueio (se status = BLOCKED)';
COMMENT ON COLUMN payout_orders.execution_metadata IS 'Dados de execução (comprovante, etc.) quando EXECUTED';
COMMENT ON COLUMN payout_orders.failure_reason IS 'Motivo da falha (se status = FAILED)';

