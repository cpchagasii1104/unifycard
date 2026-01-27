-- ============================================================
-- UNIFICARD — MIGRATION 266
-- Arquivo: 266_add_trust_audit_actions.sql
-- Tipo: EVOLUÇÃO (Adiciona ações de trust ao enum de audit)
-- Banco alvo: PostgreSQL 14+
--
-- IDEMPOTÊNCIA
-- Usa ADD VALUE IF NOT EXISTS para evitar erros em re-execução
-- ============================================================

DO $$
BEGIN
  -- Adicionar ações de trust
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'trust_event_registered' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'business_audit_action')
  ) THEN
    ALTER TYPE business_audit_action ADD VALUE IF NOT EXISTS 'trust_event_registered';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'trust_score_updated' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'business_audit_action')
  ) THEN
    ALTER TYPE business_audit_action ADD VALUE IF NOT EXISTS 'trust_score_updated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'trust_action_blocked' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'business_audit_action')
  ) THEN
    ALTER TYPE business_audit_action ADD VALUE IF NOT EXISTS 'trust_action_blocked';
  END IF;
END$$;




