/*
Arquivo: 027_event_organizers.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Escopo: Event Organizers Module

Objetivo:
- Criar organizadores multi-tenant
- Criar membros (ACL simples por role) por organizador
- Ligar events -> organizer_id

Dependências:
- tenants
- global_users
- events (026_events_core.sql)
- função update_updated_at_column()
- extensão uuid-ossp (uuid_generate_v4)
*/

-- =========================================================
-- EXTENSÕES
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================
-- EVENT ORGANIZERS
-- =========================================================

CREATE TABLE IF NOT EXISTS event_organizers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  tenant_id UUID NOT NULL
    REFERENCES tenants(tenant_id)
    ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,

  owner_global_user_id UUID NOT NULL
    REFERENCES global_users(global_user_id)
    ON DELETE RESTRICT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_event_organizers_tenant ON event_organizers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_organizers_owner ON event_organizers (owner_global_user_id);

-- RLS
ALTER TABLE event_organizers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'event_organizers'
      AND policyname = 'event_organizers_rls'
  ) THEN
    CREATE POLICY event_organizers_rls
      ON event_organizers
      USING (tenant_id::text = current_setting('app.current_tenant', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;

-- Trigger updated_at (padrão do projeto)
DROP TRIGGER IF EXISTS trg_event_organizers_updated_at ON event_organizers;
CREATE TRIGGER trg_event_organizers_updated_at
  BEFORE UPDATE ON event_organizers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- EVENT ORGANIZER MEMBERS
-- =========================================================

CREATE TABLE IF NOT EXISTS event_organizer_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  organizer_id UUID NOT NULL
    REFERENCES event_organizers(id)
    ON DELETE CASCADE,

  global_user_id UUID NOT NULL
    REFERENCES global_users(global_user_id)
    ON DELETE CASCADE,

  role TEXT NOT NULL CHECK (role IN ('owner','admin','editor','viewer')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT event_organizer_members_unique UNIQUE (organizer_id, global_user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_event_organizer_members_organizer ON event_organizer_members (organizer_id);
CREATE INDEX IF NOT EXISTS idx_event_organizer_members_user ON event_organizer_members (global_user_id);

-- RLS (herda do organizer)
ALTER TABLE event_organizer_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename  = 'event_organizer_members'
      AND policyname = 'event_organizer_members_rls'
  ) THEN
    CREATE POLICY event_organizer_members_rls
      ON event_organizer_members
      USING (
        EXISTS (
          SELECT 1
          FROM event_organizers o
          WHERE o.id = event_organizer_members.organizer_id
            AND o.tenant_id::text = current_setting('app.current_tenant', true)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM event_organizers o
          WHERE o.id = event_organizer_members.organizer_id
            AND o.tenant_id::text = current_setting('app.current_tenant', true)
        )
      );
  END IF;
END $$;

-- =========================================================
-- ALTER TABLE EVENTS
-- =========================================================

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS organizer_id UUID
    REFERENCES event_organizers(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_organizer
  ON events (organizer_id)
  WHERE organizer_id IS NOT NULL;

-- =========================================================
-- COMENTÁRIOS
-- =========================================================

COMMENT ON TABLE event_organizers IS 'Organizadores de eventos';
COMMENT ON TABLE event_organizer_members IS 'Membros de organizadores de eventos';
COMMENT ON COLUMN events.organizer_id IS 'Organizador responsável pelo evento';








