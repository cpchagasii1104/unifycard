-- ============================================================
-- UNIFICARD - MIGRATION 223
-- SPRINT 84: KYC BÁSICO + DADOS OBRIGATÓRIOS FISCAIS
-- Adiciona campo kyc_status na tabela contacts
-- ============================================================
--
-- OBJETIVO:
-- Adicionar campo kyc_status para rastrear status de validação KYC
-- básica dos contatos.
--
-- REGRAS:
-- - KYC básico: valida CPF/CNPJ + nome + email/phone
-- - Status: UNVERIFIED (default) ou BASIC_VERIFIED
-- - Não bloqueia venda, apenas emissão fiscal
-- ============================================================

-- ============================================================
-- ENUM: KYC Status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kyc_status') THEN
    CREATE TYPE kyc_status AS ENUM (
      'UNVERIFIED',      -- Não verificado (default)
      'BASIC_VERIFIED'   -- Verificado basicamente (CPF/CNPJ + nome + email/phone)
    );
  END IF;
END$$;

-- ============================================================
-- ADICIONAR COLUNA
-- ============================================================
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS kyc_status kyc_status NOT NULL DEFAULT 'UNVERIFIED';

-- ============================================================
-- ÍNDICE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_contacts_kyc_status
    ON contacts(tenant_id, kyc_status)
    WHERE kyc_status = 'BASIC_VERIFIED';

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON COLUMN contacts.kyc_status IS 'Status de validação KYC básica. UNVERIFIED (default) ou BASIC_VERIFIED. Não bloqueia venda, apenas emissão fiscal.';





