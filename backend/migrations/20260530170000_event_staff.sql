-- Migration: event_staff
-- Forward-only, sem DROP
-- responsible_actor_id é a chave operacional canônica (LEI §4.8, CORE_IDENTITY_AND_ACTORS_CONTRACT)
-- global_user_id e assigned_by_global_user_id mantidos por compatibilidade legada

CREATE TABLE IF NOT EXISTS event_staff (
  id                        UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id                 UUID        NOT NULL REFERENCES tenants(id),
  event_id                  UUID        NOT NULL REFERENCES events(id),
  responsible_actor_id      UUID        NOT NULL REFERENCES actors(id),
  responsible_actor_type    TEXT        NOT NULL,
  role                      TEXT        NOT NULL,
  status                    TEXT        NOT NULL DEFAULT 'active',
  time_window_ref           TEXT,
  source                    TEXT,
  global_user_id            UUID        REFERENCES global_users(global_user_id),
  assigned_by_global_user_id UUID       REFERENCES global_users(global_user_id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN event_staff.global_user_id IS
  'Legado — usar responsible_actor_id como chave operacional (LEI §4.8)';
COMMENT ON COLUMN event_staff.assigned_by_global_user_id IS
  'Legado — migrar para actor_id quando events.service.ts for auditado';
