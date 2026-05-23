-- Camada 2: falhas de handler persistidas + retry por (tenant_id, event_id, handler_key).
-- Worker usa pool direto (sem RLS), alinhado a event_outbox.

BEGIN;

CREATE TABLE IF NOT EXISTS event_handler_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  event_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  handler_key TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 10,
  next_retry_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'retrying', 'dead')),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_handler_failures_uk UNIQUE (tenant_id, event_id, handler_key)
);

CREATE INDEX IF NOT EXISTS idx_event_handler_failures_retry
  ON event_handler_failures (status, next_retry_at ASC, created_at ASC)
  WHERE status IN ('pending', 'retrying');

COMMENT ON TABLE event_handler_failures IS
  'Falhas de execução de handlers pós-publish. Retry por handler_key apenas — nunca republicar o evento inteiro.';

COMMIT;
