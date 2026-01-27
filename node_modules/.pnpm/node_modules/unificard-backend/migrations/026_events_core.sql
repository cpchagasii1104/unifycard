/*
Arquivo: 026_events_core.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Escopo: Events Core Module (UNIFY EVENTS)

Objetivo:
- Criar o núcleo de eventos: eventos, sessões, locais, staff e participantes
- Aplicar RLS por tenant via tabela pai (events)

Dependências:
- tenants
- global_users (022_global_identity.sql)
- countries/states/cities (019_world_geography.sql)
- função update_updated_at_column()
- extensão uuid-ossp (para uuid_generate_v4)
*/

-- =========================================================
-- EXTENSÕES
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================
-- EVENTS
-- =========================================================

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id)
    ON DELETE CASCADE,

  title TEXT NOT NULL,
  description TEXT,

  start_time TIMESTAMPTZ NOT NULL,
  end_time   TIMESTAMPTZ NOT NULL,

  city_id    UUID REFERENCES cities(city_id)       ON DELETE SET NULL,
  state_id   UUID REFERENCES states(state_id)      ON DELETE SET NULL,
  country_id UUID REFERENCES countries(country_id) ON DELETE SET NULL,

  created_by_global_user_id UUID NOT NULL
    REFERENCES global_users(global_user_id)
    ON DELETE RESTRICT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT events_time_check CHECK (end_time > start_time)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_events_tenant ON events (tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events (created_by_global_user_id);
CREATE INDEX IF NOT EXISTS idx_events_city ON events (city_id) WHERE city_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events (start_time);
CREATE INDEX IF NOT EXISTS idx_events_end_time ON events (end_time);

-- RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'events'
      AND policyname = 'events_rls'
  ) THEN
    CREATE POLICY events_rls
      ON events
      USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- Trigger updated_at (padrão do projeto)
DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- EVENT SESSIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS event_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  event_id UUID NOT NULL
    REFERENCES events(id)
    ON DELETE CASCADE,

  name TEXT NOT NULL,

  start_time TIMESTAMPTZ NOT NULL,
  end_time   TIMESTAMPTZ NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT event_sessions_time_check CHECK (end_time > start_time)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_event_sessions_event ON event_sessions (event_id);
CREATE INDEX IF NOT EXISTS idx_event_sessions_start_time ON event_sessions (start_time);

-- RLS (herda do event via EXISTS)
ALTER TABLE event_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'event_sessions'
      AND policyname = 'event_sessions_rls'
  ) THEN
    CREATE POLICY event_sessions_rls
      ON event_sessions
      USING (
        EXISTS (
          SELECT 1
          FROM events e
          WHERE e.id = event_sessions.event_id
            AND e.tenant_id::text = current_setting('app.current_tenant', true)
        )
      );
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_event_sessions_updated_at ON event_sessions;
CREATE TRIGGER trg_event_sessions_updated_at
  BEFORE UPDATE ON event_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- EVENT LOCATIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS event_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  event_id UUID NOT NULL
    REFERENCES events(id)
    ON DELETE CASCADE,

  name TEXT NOT NULL,
  capacity INTEGER CHECK (capacity > 0),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_event_locations_event ON event_locations (event_id);

-- RLS (herda do event via EXISTS)
ALTER TABLE event_locations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'event_locations'
      AND policyname = 'event_locations_rls'
  ) THEN
    CREATE POLICY event_locations_rls
      ON event_locations
      USING (
        EXISTS (
          SELECT 1
          FROM events e
          WHERE e.id = event_locations.event_id
            AND e.tenant_id::text = current_setting('app.current_tenant', true)
        )
      );
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_event_locations_updated_at ON event_locations;
CREATE TRIGGER trg_event_locations_updated_at
  BEFORE UPDATE ON event_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- EVENT STAFF
-- =========================================================

CREATE TABLE IF NOT EXISTS event_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  event_id UUID NOT NULL
    REFERENCES events(id)
    ON DELETE CASCADE,

  global_user_id UUID NOT NULL
    REFERENCES global_users(global_user_id)
    ON DELETE CASCADE,

  role TEXT NOT NULL,

  assigned_by_global_user_id UUID NOT NULL
    REFERENCES global_users(global_user_id)
    ON DELETE RESTRICT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT event_staff_unique UNIQUE (event_id, global_user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_event_staff_event ON event_staff (event_id);
CREATE INDEX IF NOT EXISTS idx_event_staff_user ON event_staff (global_user_id);

-- RLS (herda do event via EXISTS)
ALTER TABLE event_staff ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'event_staff'
      AND policyname = 'event_staff_rls'
  ) THEN
    CREATE POLICY event_staff_rls
      ON event_staff
      USING (
        EXISTS (
          SELECT 1
          FROM events e
          WHERE e.id = event_staff.event_id
            AND e.tenant_id::text = current_setting('app.current_tenant', true)
        )
      );
  END IF;
END $$;

-- =========================================================
-- EVENT ATTENDEES
-- =========================================================

CREATE TABLE IF NOT EXISTS event_attendees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  event_id UUID NOT NULL
    REFERENCES events(id)
    ON DELETE CASCADE,

  global_user_id UUID NOT NULL
    REFERENCES global_users(global_user_id)
    ON DELETE CASCADE,

  check_in_time TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT event_attendees_unique UNIQUE (event_id, global_user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_event_attendees_event ON event_attendees (event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user ON event_attendees (global_user_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_check_in ON event_attendees (check_in_time)
  WHERE check_in_time IS NOT NULL;

-- RLS (herda do event via EXISTS)
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'event_attendees'
      AND policyname = 'event_attendees_rls'
  ) THEN
    CREATE POLICY event_attendees_rls
      ON event_attendees
      USING (
        EXISTS (
          SELECT 1
          FROM events e
          WHERE e.id = event_attendees.event_id
            AND e.tenant_id::text = current_setting('app.current_tenant', true)
        )
      );
  END IF;
END $$;

-- =========================================================
-- COMENTÁRIOS
-- =========================================================

COMMENT ON TABLE events IS 'Eventos do sistema (UNIFY EVENTS)';
COMMENT ON TABLE event_sessions IS 'Sessões/atividades dentro de um evento';
COMMENT ON TABLE event_locations IS 'Locais físicos dentro de um evento';
COMMENT ON TABLE event_staff IS 'Staff/equipe designada para eventos';
COMMENT ON TABLE event_attendees IS 'Participantes/inscritos em eventos';








