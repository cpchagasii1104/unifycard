-- ============================================================
-- MIGRATION 251: FIX OCCUPANCY SCHEMA
-- Arquivo: 20260530470000_fix_occupancy_schema.sql
-- Problema: event_occupancy_models e event_reservations foram
--   criadas no genesis com schema simplificado. O código evoluiu
--   para um modelo rico (occupancy_type, config, resource_*).
--   Esta migration sincroniza o banco com o código sem destruir
--   colunas existentes (dados históricos preservados).
-- ============================================================

BEGIN;

-- ============================================================
-- 1. event_occupancy_models — adicionar colunas que o código usa
-- ============================================================

ALTER TABLE event_occupancy_models
  ADD COLUMN IF NOT EXISTS occupancy_type TEXT NOT NULL DEFAULT 'PERSON'
    CHECK (occupancy_type IN ('TABLE','PERSON','SLOT','HYBRID')),
  ADD COLUMN IF NOT EXISTS requires_reservation BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reservation_price_cents BIGINT,
  ADD COLUMN IF NOT EXISTS reservation_currency TEXT NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS no_show_penalty_cents BIGINT,
  ADD COLUMN IF NOT EXISTS no_show_penalty_currency TEXT NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS auto_cancel_after_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Índice para busca por event_id (já existe UNIQUE, mas garantir)
CREATE INDEX IF NOT EXISTS idx_event_occupancy_models_event
  ON event_occupancy_models(event_id);

-- ============================================================
-- 2. event_reservations — adicionar colunas que o código usa
-- ============================================================
-- A migration genesis usou actor_id + quantity + session_id.
-- O código usa global_user_id + occupancy_model_id + resource_*.
-- Adicionamos as novas sem dropar as antigas.

ALTER TABLE event_reservations
  ADD COLUMN IF NOT EXISTS global_user_id UUID REFERENCES actors(id),
  ADD COLUMN IF NOT EXISTS occupancy_model_id UUID REFERENCES event_occupancy_models(id),
  ADD COLUMN IF NOT EXISTS resource_type TEXT
    CHECK (resource_type IN ('TABLE','PERSON','SLOT')),
  ADD COLUMN IF NOT EXISTS resource_id TEXT,
  ADD COLUMN IF NOT EXISTS resource_name TEXT,
  ADD COLUMN IF NOT EXISTS reservation_price_cents BIGINT,
  ADD COLUMN IF NOT EXISTS reservation_currency TEXT NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES bank_transactions(id),
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS no_show_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Ampliar o CHECK de status para incluir os valores do código
-- (genesis tinha: pending,confirmed,cancelled,expired)
-- (código usa:    PENDING,CONFIRMED,CHECKED_IN,NO_SHOW,CANCELLED)
-- Solução: dropar constraint antiga e criar nova que cobre ambos

ALTER TABLE event_reservations
  DROP CONSTRAINT IF EXISTS event_reservations_status_check;

ALTER TABLE event_reservations
  ADD CONSTRAINT event_reservations_status_check
    CHECK (status IN (
      'pending','confirmed','cancelled','expired',
      'PENDING','CONFIRMED','CHECKED_IN','NO_SHOW','CANCELLED'
    ));

CREATE INDEX IF NOT EXISTS idx_event_reservations_occupancy_model
  ON event_reservations(occupancy_model_id);

CREATE INDEX IF NOT EXISTS idx_event_reservations_global_user
  ON event_reservations(global_user_id);

COMMIT;
