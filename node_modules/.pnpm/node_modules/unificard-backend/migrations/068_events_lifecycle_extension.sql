-- ============================================================
-- UNIFICARD — MIGRATION 068
-- Arquivo: 068_events_lifecycle_extension.sql
-- Tipo: EVOLUÇÃO ESTRUTURAL (lifecycle de eventos)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Esta migration estende a tabela events para suportar
-- lifecycle completo, integração com agendas (schedules)
-- e novos atributos operacionais.
--
-- O objetivo é permitir que eventos tenham:
-- • tipo explícito
-- • status controlado
-- • agenda associada
-- • controle de capacidade
-- • configuração operacional (consumo, estacionamento)
--
-- DECISÕES IMPORTANTES
-- • Valores monetários são armazenados em CENTAVOS
-- • O banco NÃO valida transições de status
-- • O banco NÃO valida lotação (occupancy)
-- • Timezone segue padrão IANA (ex: America/Sao_Paulo)
-- • Regras de negócio vivem na aplicação
--
-- DEPENDÊNCIAS
-- • events
-- • schedules (migration 063–067)
--
-- IDEMPOTÊNCIA
-- • Todas as alterações usam IF NOT EXISTS ou guards
--
-- ============================================================


-- ============================================================
-- 1) NOVAS COLUNAS DE LIFECYCLE
-- ============================================================

ALTER TABLE events
ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'SHOW',
ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
ADD COLUMN IF NOT EXISTS ticket_price_cents INTEGER,
ADD COLUMN IF NOT EXISTS accepts_consumption BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS accepts_parking BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS max_capacity INTEGER,
ADD COLUMN IF NOT EXISTS current_occupancy INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'DRAFT';


-- ============================================================
-- 2) INTEGRAÇÃO COM SCHEDULES (BLOQUEIO 2)
-- ============================================================

ALTER TABLE events
ADD COLUMN IF NOT EXISTS schedule_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_events_schedule'
      AND conrelid = 'events'::regclass
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT fk_events_schedule
      FOREIGN KEY (schedule_id)
      REFERENCES schedules(schedule_id)
      ON DELETE SET NULL;
  END IF;
END $$;


-- ============================================================
-- 3) OWNERSHIP (EMPRESA)
-- ============================================================

ALTER TABLE events
ADD COLUMN IF NOT EXISTS created_by_company_id UUID;


-- ============================================================
-- 4) CONSTRAINTS DE DOMÍNIO (COM GUARD)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_event_type_check'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_event_type_check CHECK (
        event_type IN (
          'SHOW',
          'CINEMA',
          'ESPORTE',
          'BAR',
          'RESTAURANTE',
          'FEIRA',
          'WORKSHOP',
          'EXPOSICAO',
          'FESTIVAL',
          'BALADA'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_status_check'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_status_check CHECK (
        status IN (
          'DRAFT',
          'PUBLISHED',
          'ONGOING',
          'FINISHED',
          'CANCELLED'
        )
      );
  END IF;
END $$;


-- ============================================================
-- 5) ÍNDICES DE PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_events_schedule
  ON events (schedule_id)
  WHERE schedule_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_type_status
  ON events (event_type, status);

CREATE INDEX IF NOT EXISTS idx_events_capacity
  ON events (current_occupancy, max_capacity)
  WHERE max_capacity IS NOT NULL;


-- ============================================================
-- COMENTÁRIOS
-- ============================================================

COMMENT ON COLUMN events.ticket_price_cents IS
  'Preço do ingresso em centavos (integer para evitar erros financeiros)';

COMMENT ON COLUMN events.timezone IS
  'Timezone do evento no padrão IANA (ex: America/Sao_Paulo)';

COMMENT ON COLUMN events.current_occupancy IS
  'Ocupação atual do evento. Validações de limite ocorrem na aplicação';

COMMENT ON COLUMN events.status IS
  'Status do lifecycle do evento. Transições são controladas pela aplicação';


-- ============================================================
-- FIM 068_events_lifecycle_extension.sql
-- ============================================================













