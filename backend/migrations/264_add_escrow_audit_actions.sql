-- ============================================================
-- UNIFICARD — MIGRATION 264
-- Arquivo: 264_add_escrow_audit_actions.sql
-- Tipo: EVOLUÇÃO (Adiciona ações de escrow ao enum de audit)
-- Banco alvo: PostgreSQL 14+
--
-- IDEMPOTÊNCIA
-- Usa ADD VALUE IF NOT EXISTS para evitar erros em re-execução
-- ============================================================

DO $$
BEGIN
  -- Adicionar ações de escrow
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'escrow_created' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'business_audit_action')
  ) THEN
    ALTER TYPE business_audit_action ADD VALUE IF NOT EXISTS 'escrow_created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'funds_held' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'business_audit_action')
  ) THEN
    ALTER TYPE business_audit_action ADD VALUE IF NOT EXISTS 'funds_held';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'milestone_reached' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'business_audit_action')
  ) THEN
    ALTER TYPE business_audit_action ADD VALUE IF NOT EXISTS 'milestone_reached';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'funds_released' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'business_audit_action')
  ) THEN
    ALTER TYPE business_audit_action ADD VALUE IF NOT EXISTS 'funds_released';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'refund_issued' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'business_audit_action')
  ) THEN
    ALTER TYPE business_audit_action ADD VALUE IF NOT EXISTS 'refund_issued';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'escrow_bypass_attempted' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'business_audit_action')
  ) THEN
    ALTER TYPE business_audit_action ADD VALUE IF NOT EXISTS 'escrow_bypass_attempted';
  END IF;
END$$;




