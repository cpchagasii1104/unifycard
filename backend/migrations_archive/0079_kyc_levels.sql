-- ============================================================
-- MIGRATION 079 — KYC LEVELS E LIMITES CONSTITUCIONAIS
-- BLOCO 2 · FECHA GATE DE IDENTIDADE (KYC)
-- ============================================================
-- Regra:
-- KYC define limites máximos de poder financeiro.
-- Enforcement operacional ocorre em BLOCO posterior.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. ENUM DE NÍVEIS DE KYC (CANÔNICO)
-- ------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kyc_level') THEN
    CREATE TYPE kyc_level AS ENUM ('none', 'basic', 'complete');
  END IF;
END$$;

-- ------------------------------------------------------------
-- 2. COLUNAS DE KYC EM ACTORS
-- ------------------------------------------------------------

ALTER TABLE actors
  ADD COLUMN IF NOT EXISTS kyc_level kyc_level NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kyc_verified_by TEXT;

COMMENT ON COLUMN actors.kyc_level IS
  'Nível de verificação de identidade (KYC) do ator';

COMMENT ON COLUMN actors.kyc_verified_at IS
  'Timestamp da última verificação KYC válida';

COMMENT ON COLUMN actors.kyc_verified_by IS
  'Sistema ou parceiro responsável pela verificação KYC';

-- ------------------------------------------------------------
-- 3. TABELA DE LIMITES POR NÍVEL DE KYC
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS kyc_limits (
  kyc_level kyc_level PRIMARY KEY,

  max_credit_cents BIGINT NOT NULL,
  max_transfer_daily_cents BIGINT NOT NULL,
  max_single_transfer_cents BIGINT NOT NULL,

  can_create_company BOOLEAN NOT NULL DEFAULT false,
  can_be_guardian BOOLEAN NOT NULL DEFAULT false,
  can_delegate_financial BOOLEAN NOT NULL DEFAULT false,

  description TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE kyc_limits IS
  'Limites constitucionais de poder financeiro por nível de KYC';

-- ------------------------------------------------------------
-- 4. VALORES CONSTITUCIONAIS PADRÃO
-- ------------------------------------------------------------

INSERT INTO kyc_limits (
  kyc_level,
  max_credit_cents,
  max_transfer_daily_cents,
  max_single_transfer_cents,
  can_create_company,
  can_be_guardian,
  can_delegate_financial,
  description
) VALUES
  (
    'none',
    10000,
    10000,
    5000,
    false,
    false,
    false,
    'Sem KYC: até R$100 total, R$50 por operação'
  ),
  (
    'basic',
    50000,
    50000,
    25000,
    false,
    false,
    false,
    'KYC básico (CPF + selfie): até R$500'
  ),
  (
    'complete',
    100000000,
    1000000,
    500000,
    true,
    true,
    true,
    'KYC completo: até R$1M, pode criar empresa e ser guardião'
  )
ON CONFLICT (kyc_level) DO NOTHING;

-- ------------------------------------------------------------
-- 5. ÍNDICE PARA CONSULTA RÁPIDA
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_actors_kyc_level
  ON actors (kyc_level);

-- ------------------------------------------------------------
-- 6. FUNÇÃO MÍNIMA DE VERIFICAÇÃO DE LIMITE KYC
-- ------------------------------------------------------------
-- ATENÇÃO:
-- Esta função NÃO executa enforcement final.
-- Ela apenas expõe limites canônicos para uso posterior.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION check_kyc_limit(
  p_actor_id UUID,
  p_amount_cents BIGINT,
  p_operation_type TEXT DEFAULT 'transfer'
) RETURNS BOOLEAN AS $$
DECLARE
  v_kyc_level kyc_level;
  v_limit BIGINT;
BEGIN
  SELECT kyc_level
    INTO v_kyc_level
    FROM actors
   WHERE id = p_actor_id;

  IF v_kyc_level IS NULL THEN
    v_kyc_level := 'none';
  END IF;

  SELECT max_single_transfer_cents
    INTO v_limit
    FROM kyc_limits
   WHERE kyc_level = v_kyc_level;

  IF v_limit IS NULL THEN
    RETURN false;
  END IF;

  RETURN p_amount_cents <= v_limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION check_kyc_limit IS
  'Verificação mínima de limite KYC (enforcement completo ocorre em BLOCO posterior)';

COMMIT;
