-- ============================================================
-- UNIFICARD — MIGRATION 267
-- Arquivo: 267_add_bypass_audit_actions.sql
-- Tipo: EVOLUÇÃO (Adiciona ações de bypass ao enum de audit)
-- Banco alvo: PostgreSQL 14+
--
-- IDEMPOTÊNCIA
-- Usa ADD VALUE IF NOT EXISTS para evitar erros em re-execução
-- ============================================================

DO $$
BEGIN
  -- Adicionar ações de bypass
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'bypass_detected' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'business_audit_action')
  ) THEN
    ALTER TYPE business_audit_action ADD VALUE IF NOT EXISTS 'bypass_detected';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'off_platform_attempt' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'business_audit_action')
  ) THEN
    ALTER TYPE business_audit_action ADD VALUE IF NOT EXISTS 'off_platform_attempt';
  END IF;
END$$;




