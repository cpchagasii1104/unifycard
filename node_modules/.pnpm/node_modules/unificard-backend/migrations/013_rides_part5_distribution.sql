/*
Arquivo: 013_rides_part5_distribution.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Escopo: Regras de distribuição financeira por corrida (Rides)

Objetivo:
- Definir regras (percentuais) de split por corrida
- Persistir distribuição calculada por ride (snapshot da regra + valores)

Dependências:
- extensão uuid-ossp
- rides_rides (011_rides_part3_ride_lifecycle.sql)
Observações:
- Não cria lançamentos financeiros (transactions/ledger) aqui: este arquivo só modela regras + resultado do split.
*/

-- =========================================================
-- EXTENSÕES
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================
-- REGRAS DE DISTRIBUIÇÃO
-- =========================================================

CREATE TABLE IF NOT EXISTS rides_distribution_rules (
  rule_id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL,

  name                  VARCHAR(150) NOT NULL,

  percentage_driver     NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (percentage_driver >= 0 AND percentage_driver <= 100),
  percentage_platform   NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (percentage_platform >= 0 AND percentage_platform <= 100),
  percentage_fund       NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (percentage_fund >= 0 AND percentage_fund <= 100),
  percentage_referral   NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (percentage_referral >= 0 AND percentage_referral <= 100),

  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- soma total não pode exceder 100 (CHECK válido, sem subquery)
  CONSTRAINT rides_distribution_rules_total_pct_chk
    CHECK ((percentage_driver + percentage_platform + percentage_fund + percentage_referral) <= 100),

  UNIQUE (tenant_id, name)
);

ALTER TABLE IF EXISTS rides_distribution_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'rides_distribution_rules'
      AND policyname = 'rides_distribution_rules_rls'
  ) THEN
    CREATE POLICY rides_distribution_rules_rls
      ON rides_distribution_rules
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rides_distribution_rules_tenant_active
  ON rides_distribution_rules (tenant_id, is_active);

-- =========================================================
-- DISTRIBUIÇÃO POR CORRIDA
-- =========================================================

CREATE TABLE IF NOT EXISTS rides_ride_distributions (
  ride_distribution_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL,

  ride_id               UUID NOT NULL REFERENCES rides_rides(ride_id) ON DELETE CASCADE,

  driver_amount         NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (driver_amount >= 0),
  platform_amount       NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (platform_amount >= 0),
  fund_amount           NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (fund_amount >= 0),
  referral_amount       NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (referral_amount >= 0),

  rule_snapshot         JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, ride_id)
);

ALTER TABLE IF EXISTS rides_ride_distributions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'rides_ride_distributions'
      AND policyname = 'rides_ride_distributions_rls'
  ) THEN
    CREATE POLICY rides_ride_distributions_rls
      ON rides_ride_distributions
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rides_ride_distributions_tenant_created
  ON rides_ride_distributions (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rides_ride_distributions_tenant_ride
  ON rides_ride_distributions (tenant_id, ride_id);
