-- ============================================================
-- EVENTS (domínio canónico) + execução financeira pós-evento
-- Alinhado a docs/01_normative/07_NOMENCLATURA_CANONICA.md §4.38
-- e docs/01_normative/SSOT_REGISTRY_UNIFICARD.md (Identidade Global de Ator).
--
-- Idempotente: CREATE IF NOT EXISTS / guards.
-- split_processed / completed_at NÃO ficam em events — estado em
-- event_financial_execution.
-- ============================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  actor_id UUID NOT NULL REFERENCES actors(id) ON DELETE RESTRICT,
  actor_type VARCHAR(30) NOT NULL
    CONSTRAINT chk_events_actor_type_operational CHECK (
      actor_type IN ('user', 'page', 'group', 'channel', 'system')
    ),

  event_type TEXT NOT NULL,
  event_subtype TEXT,

  title TEXT NOT NULL,
  description TEXT,

  datetime_start TIMESTAMPTZ,
  datetime_end TIMESTAMPTZ,

  timezone TEXT NOT NULL DEFAULT 'UTC',

  status TEXT NOT NULL DEFAULT 'draft'
    CONSTRAINT chk_events_status_lifecycle CHECK (
      status IN (
        'draft',
        'declared',
        'published',
        'active',
        'ended',
        'cancelled'
      )
    ),

  visibility TEXT NOT NULL DEFAULT 'public'
    CONSTRAINT chk_events_visibility CHECK (
      visibility IN ('public', 'private', 'unlisted', 'group', 'followers')
    ),

  max_attendees INTEGER
    CONSTRAINT chk_events_max_attendees CHECK (
      max_attendees IS NULL OR max_attendees > 0
    ),

  ticket_price_cents BIGINT
    CONSTRAINT chk_events_ticket_price_cents CHECK (
      ticket_price_cents IS NULL OR ticket_price_cents >= 0
    ),

  currency TEXT NOT NULL DEFAULT 'BRL',

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_events_datetime_order CHECK (
    datetime_start IS NULL
    OR datetime_end IS NULL
    OR datetime_end > datetime_start
  )
);

CREATE INDEX IF NOT EXISTS idx_events_tenant_id ON events (tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_tenant_actor ON events (tenant_id, actor_id);
CREATE INDEX IF NOT EXISTS idx_events_tenant_event_type ON events (tenant_id, event_type);
CREATE INDEX IF NOT EXISTS idx_events_tenant_status ON events (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_events_datetime_start ON events (datetime_start);

CREATE INDEX IF NOT EXISTS idx_events_metadata_gin ON events USING GIN (metadata);

COMMENT ON TABLE events IS
  'Agregado de evento (domínio). Sem estado de execução financeira — ver event_financial_execution.';

-- ---------------------------------------------------------------------------
-- 2) event_financial_execution — checkpoint de split / execução pós-evento
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_financial_execution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT chk_event_financial_execution_status CHECK (
      status IN ('pending', 'processing', 'completed', 'failed')
    ),

  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,

  CONSTRAINT uidx_event_financial_execution_tenant_event UNIQUE (tenant_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_financial_execution_tenant_status
  ON event_financial_execution (tenant_id, status);

COMMENT ON TABLE event_financial_execution IS
  'Estado operacional de execução financeira pós-evento (ex.: split). Não substitui ledger/bank.';

COMMIT;
