BEGIN;

-- Migration: C63 FASE 2B — Etapa 1
-- Adiciona colunas de referência ao SSOT temporal canônico (unified_availability)
-- Forward-only. Sem FK obrigatória nesta etapa. Sem NOT NULL (dados existentes).
-- Ref: RFC_C63_FASE2B.md, DECISION-0015

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'events'
      AND column_name  = 'unified_availability_id'
  ) THEN
    ALTER TABLE events ADD COLUMN unified_availability_id UUID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'event_tickets'
      AND column_name  = 'unified_booking_id'
  ) THEN
    ALTER TABLE event_tickets ADD COLUMN unified_booking_id UUID;
  END IF;
END $$;

COMMIT;
