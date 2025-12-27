-- ================================================
-- UNIFICARD - MIGRATION 065
-- Schedule Performance Indexes (FASE 1.3)
-- Índices de Performance (não opcionais)
-- ================================================

CREATE INDEX IF NOT EXISTS idx_slots_user_time 
  ON schedule_slots(reserved_by_global_user_id, start_time)
  WHERE reserved_by_global_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_slots_available 
  ON schedule_slots(schedule_id, start_time)
  WHERE status = 'available';

CREATE INDEX IF NOT EXISTS idx_slots_status_time 
  ON schedule_slots(status, start_time);















