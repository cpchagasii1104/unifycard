-- ============================================================
-- MIGRATION 129 — SETTLEMENT EXTERNO
-- BLOCO 1 · FECHA GATE JURÍDICO
-- ============================================================
-- REGRA CONSTITUCIONAL:
-- Conclusão interna ≠ Liquidação externa
-- Liquidação externa SOMENTE via parceiro confirmado
-- ============================================================
-- REFERÊNCIA NORMATIVA:
-- Nomenclatura validada contra:
-- docs/01_normative/07_NOMENCLATURA_CANONICA.md
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. COLUNAS CANÔNICAS DE SETTLEMENT
-- ------------------------------------------------------------

ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS internal_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS external_settled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS settlement_reference TEXT,
  ADD COLUMN IF NOT EXISTS settlement_partner TEXT,
  ADD COLUMN IF NOT EXISTS settlement_method TEXT;

COMMENT ON COLUMN bank_transactions.internal_completed_at IS
  'Conclusão interna da transação (governança do sistema)';

COMMENT ON COLUMN bank_transactions.external_settled_at IS
  'Liquidação confirmada por parceiro externo (SSOT financeiro)';

COMMENT ON COLUMN bank_transactions.settlement_partner IS
  'Parceiro externo responsável pela liquidação';

COMMENT ON COLUMN bank_transactions.settlement_reference IS
  'Referência externa de liquidação fornecida pelo parceiro';

COMMENT ON COLUMN bank_transactions.settlement_method IS
  'Método de liquidação externa (PIX, cartão, boleto, etc)';

-- ------------------------------------------------------------
-- 2. MIGRAÇÃO DE DADOS LEGADOS
-- ------------------------------------------------------------
-- settled_at passa a significar APENAS conclusão interna

UPDATE bank_transactions
SET internal_completed_at = settled_at
WHERE settled_at IS NOT NULL
  AND internal_completed_at IS NULL;

COMMENT ON COLUMN bank_transactions.settled_at IS
  'DEPRECATED: usar internal_completed_at (interno) e external_settled_at (externo)';

-- ------------------------------------------------------------
-- 3. TABELA DE CALLBACKS DE SETTLEMENT EXTERNO
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS settlement_callbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL REFERENCES tenants(id),
  transaction_id UUID NOT NULL REFERENCES bank_transactions(id),

  partner_name TEXT NOT NULL,
  partner_reference TEXT NOT NULL,
  partner_timestamp TIMESTAMPTZ NOT NULL,

  callback_status TEXT NOT NULL CHECK (
    callback_status IN ('received', 'validated', 'applied', 'rejected')
  ),

  rejection_reason TEXT,
  raw_payload JSONB,

  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  validated_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,

  CONSTRAINT settlement_callbacks_unique_partner
    UNIQUE (partner_name, partner_reference)
);

COMMENT ON TABLE settlement_callbacks IS
  'Registro auditável de callbacks de liquidação externa';

-- Unicidade de liquidação aplicada por transação
CREATE UNIQUE INDEX IF NOT EXISTS ux_settlement_callbacks_tx_applied
ON settlement_callbacks (transaction_id)
WHERE callback_status = 'applied';

-- ------------------------------------------------------------
-- 4. FUNÇÃO CANÔNICA DE LIQUIDAÇÃO EXTERNA
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION mark_externally_settled(
  p_transaction_id UUID,
  p_partner_name TEXT,
  p_partner_reference TEXT,
  p_partner_timestamp TIMESTAMPTZ DEFAULT now()
) RETURNS BOOLEAN AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id
  INTO v_tenant_id
  FROM bank_transactions
  WHERE id = p_transaction_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found: %', p_transaction_id;
  END IF;

  -- Registrar callback aplicado (falha se já existir)
  INSERT INTO settlement_callbacks (
    tenant_id,
    transaction_id,
    partner_name,
    partner_reference,
    partner_timestamp,
    callback_status,
    applied_at
  ) VALUES (
    v_tenant_id,
    p_transaction_id,
    p_partner_name,
    p_partner_reference,
    p_partner_timestamp,
    'applied',
    now()
  );

  -- Marcar liquidação externa SOMENTE se ainda não liquidada
  UPDATE bank_transactions
  SET
    external_settled_at = now(),
    settlement_partner = p_partner_name,
    settlement_reference = p_partner_reference
  WHERE id = p_transaction_id
    AND external_settled_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction already externally settled: %', p_transaction_id;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION mark_externally_settled IS
  'ÚNICA forma válida de registrar liquidação externa de transação';

-- ------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (MULTI-TENANT)
-- ------------------------------------------------------------

ALTER TABLE settlement_callbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY settlement_callbacks_tenant_rls
ON settlement_callbacks
USING (
  tenant_id::text = current_setting('app.current_tenant', true)
);

-- ------------------------------------------------------------
-- 6. ÍNDICES DE PERFORMANCE
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_settlement_callbacks_transaction
  ON settlement_callbacks (transaction_id);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_internal_completed
  ON bank_transactions (internal_completed_at);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_external_settled
  ON bank_transactions (external_settled_at);

COMMIT;
