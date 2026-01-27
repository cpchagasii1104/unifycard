-- ============================================================
-- UNIFICARD — MIGRATION 262
-- Arquivo: 262_add_evidence_audit_actions.sql
-- Tipo: EVOLUÇÃO (Adiciona ações de evidence ao enum de audit)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Esta migration adiciona novas ações de evidence ao enum
-- business_audit_action.
--
-- IDEMPOTÊNCIA
-- Usa ADD VALUE IF NOT EXISTS para evitar erros em re-execução
-- ============================================================

DO $$
BEGIN
  -- Adicionar 'evidence_event_added' se não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'evidence_event_added' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'business_audit_action')
  ) THEN
    ALTER TYPE business_audit_action ADD VALUE IF NOT EXISTS 'evidence_event_added';
  END IF;

  -- Adicionar 'dispute_opened' se não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'dispute_opened' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'business_audit_action')
  ) THEN
    ALTER TYPE business_audit_action ADD VALUE IF NOT EXISTS 'dispute_opened';
  END IF;

  -- Adicionar 'dispute_resolved' se não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'dispute_resolved' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'business_audit_action')
  ) THEN
    ALTER TYPE business_audit_action ADD VALUE IF NOT EXISTS 'dispute_resolved';
  END IF;
END$$;




