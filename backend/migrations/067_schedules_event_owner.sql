-- ================================================
-- UNIFICARD - MIGRATION 067
-- Schedules Event Owner (FASE 1.1)
-- Adicionar event_id em schedules
-- ================================================

-- Adicionar event_id como owner possível
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS event_id UUID NULL;

-- FK para events
ALTER TABLE schedules ADD CONSTRAINT fk_schedules_event 
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;

-- Atualizar CHECK constraint (incluir event_id)
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_owner_check;
ALTER TABLE schedules ADD CONSTRAINT schedules_owner_check CHECK (
  (
    (global_user_id IS NOT NULL)::int +
    (company_id IS NOT NULL)::int +
    (service_id IS NOT NULL)::int +
    (event_id IS NOT NULL)::int
  ) = 1
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_schedules_event_id 
  ON schedules(event_id) WHERE event_id IS NOT NULL;

-- 1 agenda por evento
CREATE UNIQUE INDEX IF NOT EXISTS uniq_schedule_event
  ON schedules(event_id) WHERE event_id IS NOT NULL;















