-- ============================================================
-- UNIFICARD — MIGRATION 071
-- Arquivo: 071_event_consumption_status.sql
-- Tipo: PATCH ADITIVO (Event Commerce)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- A tabela event_consumptions originalmente não possuía
-- lifecycle explícito. Esta migration adiciona um campo
-- status para permitir controle operacional e financeiro
-- de consumos realizados em eventos.
--
-- MODELO DE STATUS
-- • PENDING   → consumo registrado, ainda não liquidado
-- • ACTIVE    → consumo válido/confirmado
-- • CANCELLED → consumo cancelado ou estornado
--
-- GOVERNANÇA
-- • O banco NÃO controla transições de status
-- • Toda a lógica de mudança de status ocorre na aplicação
-- • DEFAULT = 'ACTIVE' garante compatibilidade com dados antigos
--
-- IDEMPOTÊNCIA
-- • Coluna criada com IF NOT EXISTS
-- • Constraint protegida por guard
--
-- DEPENDÊNCIAS
-- • event_consumptions (migration 069)
--
-- ============================================================


-- ============================================================
-- 1) ADICIONAR COLUNA status
-- ============================================================

ALTER TABLE event_consumptions
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';


-- ============================================================
-- 2) CONSTRAINT DE STATUS (COM GUARD)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_consumption_status'
      AND conrelid = 'event_consumptions'::regclass
  ) THEN
    ALTER TABLE event_consumptions
      DROP CONSTRAINT check_consumption_status;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_consumptions_status_check'
  ) THEN
    ALTER TABLE event_consumptions
      ADD CONSTRAINT event_consumptions_status_check
      CHECK (status IN ('PENDING', 'ACTIVE', 'CANCELLED'));
  END IF;
END $$;


-- ============================================================
-- 3) ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_event_consumptions_status_pending
  ON event_consumptions(status)
  WHERE status = 'PENDING';


-- ============================================================
-- 4) COMENTÁRIOS
-- ============================================================

COMMENT ON COLUMN event_consumptions.status IS
  'Status do consumo no evento: PENDING, ACTIVE ou CANCELLED. Transições controladas pela aplicação';


-- ============================================================
-- FIM 071_event_consumption_status.sql
-- ============================================================



















