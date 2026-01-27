-- ============================================================
-- UNIFICARD — AVAILABILITY CONFLICT INBOX INTEGRATION
-- Arquivo: 146_availability_conflict_inbox.sql
-- Banco alvo: PostgreSQL 14+
--
-- OBJETIVO
-- Adicionar suporte a alertas de conflito de disponibilidade no Inbox Social
--
-- REGRAS CANÔNICAS:
-- * Conflitos são ALERTAS, não bloqueios
-- * Inbox é READ MODEL (derivado de effects)
-- * Inbox NÃO decide nada, apenas ORGANIZA
--
-- ============================================================

BEGIN;

-- ============================================================
-- ATUALIZAR ENUM: inbox_source_type
-- ============================================================

-- Adicionar novo valor ao enum inbox_source_type
-- 🔴 BLINDAGEM: 'availability_conflict' é apenas organização, não decisão
DO $$
BEGIN
  -- Verificar se o valor já existe antes de adicionar
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_enum 
    WHERE enumlabel = 'availability_conflict' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'inbox_source_type')
  ) THEN
    ALTER TYPE inbox_source_type ADD VALUE 'availability_conflict';
  END IF;
END$$;

-- ============================================================
-- FIM 146_availability_conflict_inbox.sql
-- ============================================================

COMMIT;

