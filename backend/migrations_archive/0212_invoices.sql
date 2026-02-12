-- ============================================================
-- UNIFICARD — MIGRATION 270
-- Arquivo: 270_create_invoices.sql
-- Tipo: NOVA FUNCIONALIDADE (Invoice Engine)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Esta migration cria a tabela de Invoices (Faturas Fiscais)
-- para transformar Payouts EXECUTED em documentos fiscais.
--
-- REGRAS:
-- - Append-only após emissão (ISSUED)
-- - Só pode ser criado a partir de payout EXECUTED
-- - Valores vêm do Ledger
-- - Tudo amarrado a EvidencePack
--
-- IDEMPOTÊNCIA
-- Todas as alterações usam IF NOT EXISTS
-- ============================================================

-- ============================================================
-- 1) ENUM: invoice_status
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE invoice_status AS ENUM (
      'DRAFT',
      'ISSUED',
      'CANCELLED'
    );
  END IF;
END$$;

-- ============================================================
-- 2) ENUM: invoice_type
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_type') THEN
    CREATE TYPE invoice_type AS ENUM (
      'SERVICE_PROVIDER',
      'PLATFORM_FEE'
    );
  END IF;
END$$;

-- ============================================================
-- 3) TABELA: invoices
-- ============================================================

CREATE TABLE IF NOT EXISTS invoices (
  invoice_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  actor_id VARCHAR(255) NOT NULL, -- Emissor
  recipient_actor_id VARCHAR(255) NOT NULL, -- Destinatário
  invoice_type invoice_type NOT NULL,
  service_order_id UUID NULL,
  payout_order_id UUID NOT NULL, -- Obrigatório: deve referenciar payout EXECUTED
  ledger_entry_ids TEXT[] NOT NULL DEFAULT '{}', -- Array de IDs de ledger entries
  evidence_pack_id UUID NOT NULL REFERENCES evidence_packs(pack_id) ON DELETE RESTRICT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array de InvoiceItem
  subtotal_cents INTEGER NOT NULL,
  taxes_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
  status invoice_status NOT NULL DEFAULT 'DRAFT',
  -- Dados fiscais
  fiscal_metadata JSONB DEFAULT '{}'::jsonb,
  issued_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT invoices_total_positive CHECK (total_cents > 0),
  CONSTRAINT invoices_subtotal_valid CHECK (subtotal_cents >= 0),
  CONSTRAINT invoices_taxes_valid CHECK (taxes_cents >= 0),
  CONSTRAINT invoices_total_calculation CHECK (total_cents = subtotal_cents + taxes_cents),
  CONSTRAINT invoices_ledger_entries_required CHECK (array_length(ledger_entry_ids, 1) > 0),
  CONSTRAINT invoices_evidence_required CHECK (evidence_pack_id IS NOT NULL),
  CONSTRAINT invoices_payout_required CHECK (payout_order_id IS NOT NULL)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_actor ON invoices(tenant_id, actor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_recipient ON invoices(tenant_id, recipient_actor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_payout ON invoices(tenant_id, payout_order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_service_order ON invoices(tenant_id, service_order_id) WHERE service_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status ON invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_type ON invoices(tenant_id, invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_created ON invoices(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_evidence ON invoices(tenant_id, evidence_pack_id);

-- Índice único: uma invoice por payoutOrder (evita duplicação)
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_payout_unique ON invoices(tenant_id, payout_order_id) 
WHERE status IN ('DRAFT', 'ISSUED');

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_invoices_updated_at();

-- Trigger para impedir alteração após ISSUED
CREATE OR REPLACE FUNCTION prevent_invoice_modification_after_issued()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o status antigo era ISSUED e está tentando alterar
  IF OLD.status = 'ISSUED' AND (NEW.status != OLD.status OR NEW.total_cents != OLD.total_cents OR NEW.subtotal_cents != OLD.subtotal_cents OR NEW.taxes_cents != OLD.taxes_cents) THEN
    RAISE EXCEPTION 'Invoice cannot be modified after being ISSUED';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_invoice_modification_after_issued
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION prevent_invoice_modification_after_issued();

-- Comentários
COMMENT ON TABLE invoices IS 'Faturas fiscais geradas a partir de payouts executados';
COMMENT ON COLUMN invoices.payout_order_id IS 'Obrigatório: deve referenciar payout EXECUTED';
COMMENT ON COLUMN invoices.ledger_entry_ids IS 'Array de IDs de ledger entries que originam este invoice';
COMMENT ON COLUMN invoices.evidence_pack_id IS 'Obrigatório: sempre deve ter evidência';
COMMENT ON COLUMN invoices.items IS 'Array JSON de InvoiceItem';
COMMENT ON COLUMN invoices.fiscal_metadata IS 'Dados fiscais (CFOP, CNAE, natureza, etc.)';
COMMENT ON COLUMN invoices.issued_at IS 'Data de emissão (quando status = ISSUED)';
COMMENT ON COLUMN invoices.cancellation_reason IS 'Motivo do cancelamento (se status = CANCELLED)';




