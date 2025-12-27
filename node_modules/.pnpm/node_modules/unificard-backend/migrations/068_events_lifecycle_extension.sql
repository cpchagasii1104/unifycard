-- ================================================
-- UNIFICARD - MIGRATION 068
-- Events Lifecycle Extension (FASE 1.2)
-- Estender tabela events
-- ================================================

-- Adicionar colunas necessárias (se não existirem)
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'SHOW';
ALTER TABLE events ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo';
ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_price NUMERIC(10,2) NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS accepts_consumption BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS accepts_parking BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS max_capacity INT NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS current_occupancy INT NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'DRAFT';

-- 🔴 CRÍTICO: schedule_id (solução do Bloqueio 2)
ALTER TABLE events ADD COLUMN IF NOT EXISTS schedule_id UUID NULL;
ALTER TABLE events ADD CONSTRAINT fk_events_schedule 
  FOREIGN KEY (schedule_id) REFERENCES schedules(schedule_id) ON DELETE SET NULL;

-- Ownership: adicionar company (mantém user para compatibilidade)
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_by_company_id UUID NULL;

-- Constraints
ALTER TABLE events ADD CONSTRAINT check_event_type CHECK (
  event_type IN ('SHOW','CINEMA','ESPORTE','BAR','RESTAURANTE','FEIRA','WORKSHOP','EXPOSICAO','FESTIVAL','BALADA')
);

ALTER TABLE events ADD CONSTRAINT check_event_status CHECK (
  status IN ('DRAFT','PUBLISHED','ONGOING','FINISHED','CANCELLED')
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_events_schedule ON events(schedule_id);
CREATE INDEX IF NOT EXISTS idx_events_type_status ON events(event_type, status);
CREATE INDEX IF NOT EXISTS idx_events_capacity ON events(current_occupancy, max_capacity) 
  WHERE max_capacity IS NOT NULL;















