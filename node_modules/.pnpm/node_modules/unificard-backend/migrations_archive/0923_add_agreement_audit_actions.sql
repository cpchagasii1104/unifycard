-- ============================================================
-- UNIFICARD — MIGRATION 260
-- Arquivo: 260_add_agreement_audit_actions.sql
-- Tipo: EVOLUÇÃO (Adiciona ações de agreement ao enum de audit)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Esta migration adiciona novas ações de agreement ao enum
-- business_audit_action e adiciona 'agreement' ao enum
-- business_audit_context_type.
--
-- IDEMPOTÊNCIA
-- Usa ADD VALUE IF NOT EXISTS para evitar erros em re-execução
-- ============================================================

-- ============================================================
-- 1) ADICIONAR AÇÕES DE AGREEMENT AO ENUM
-- ============================================================

DO $$
BEGIN
  -- Adicionar 'production_assisted_required' se não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'production_assisted_required' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'business_audit_action')
  ) THEN
    ALTER TYPE business_audit_action ADD VALUE IF NOT EXISTS 'production_assisted_required';
  END IF;

  -- Adicionar ações de agreement
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'agreement_created' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'business_audit_action')
  ) THEN
    ALTER TYPE business_audit_action ADD VALUE IF NOT EXISTS 'agreement_created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'agreement_updated' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'business_audit_action')
  ) THEN
    ALTER TYPE business_audit_action ADD VALUE IF NOT EXISTS 'agreement_updated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'agreement_proposed' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'business_audit_action')
  ) THEN
    ALTER TYPE business_audit_action ADD VALUE IF NOT EXISTS 'agreement_proposed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'agreement_accepted' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'business_audit_action')
  ) THEN
    ALTER TYPE business_audit_action ADD VALUE IF NOT EXISTS 'agreement_accepted';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'agreement_finalized' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'business_audit_action')
  ) THEN
    ALTER TYPE business_audit_action ADD VALUE IF NOT EXISTS 'agreement_finalized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'agreement_bypass_attempted' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'business_audit_action')
  ) THEN
    ALTER TYPE business_audit_action ADD VALUE IF NOT EXISTS 'agreement_bypass_attempted';
  END IF;
END$$;

-- ============================================================
-- 2) ADICIONAR 'agreement' AO ENUM DE CONTEXT TYPE
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'agreement' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'business_audit_context_type')
  ) THEN
    ALTER TYPE business_audit_context_type ADD VALUE IF NOT EXISTS 'agreement';
  END IF;
END$$;




