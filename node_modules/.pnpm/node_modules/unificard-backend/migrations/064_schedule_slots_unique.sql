-- ================================================
-- UNIFICARD - MIGRATION 064
-- Schedule Slots Unique (FASE 1.2)
-- Constraint para Slots (necessário para idempotência)
-- ================================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_schedule_slot_time
  ON schedule_slots(schedule_id, start_time, end_time);















