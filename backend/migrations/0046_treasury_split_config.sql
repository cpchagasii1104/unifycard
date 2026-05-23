-- 0046_treasury_split_config.sql
-- Configuração do Treasury Split Engine (percentuais por tenant). Não escreve em bank_transactions nem bank_ledger.

CREATE TABLE treasury_split_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  slug TEXT NOT NULL,
  pct_regional NUMERIC(5,2) NOT NULL,
  pct_community NUMERIC(5,2) NOT NULL,
  pct_system_reserve NUMERIC(5,2) NOT NULL,
  pct_governance NUMERIC(5,2) NOT NULL,
  pct_seller NUMERIC(5,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_treasury_split_config_tenant_slug UNIQUE (tenant_id, slug),
  CONSTRAINT chk_treasury_split_config_pct_sum CHECK (
    pct_regional + pct_community + pct_system_reserve + pct_governance + pct_seller = 100.00
  )
);

CREATE INDEX idx_treasury_split_config_tenant
  ON treasury_split_config (tenant_id);

COMMENT ON TABLE treasury_split_config IS 'Configuração de percentuais do Treasury Split (regional, community, system_reserve, governance, seller). Soma = 100.';

-- Execuções de split (idempotência por settlement).
CREATE TABLE treasury_split_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  settlement_id UUID NOT NULL,
  idempotency_key TEXT,
  split_result JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_treasury_split_executions_settlement UNIQUE (settlement_id)
);

CREATE UNIQUE INDEX idx_treasury_split_executions_idempotency
  ON treasury_split_executions (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX idx_treasury_split_executions_tenant
  ON treasury_split_executions (tenant_id);

COMMENT ON TABLE treasury_split_executions IS 'Registro de execuções do Treasury Split (idempotência por settlement_id). Não escreve em bank_transactions nem bank_ledger.';
