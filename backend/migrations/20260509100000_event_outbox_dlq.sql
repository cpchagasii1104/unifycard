-- INFRA-1: retry com janela (next_retry_at), teto de tentativas, DLQ, ordem estável na fila.

BEGIN;

ALTER TABLE event_outbox
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 10;

ALTER TABLE event_outbox
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ NULL;

DROP INDEX IF EXISTS idx_event_outbox_pending_created;

CREATE INDEX IF NOT EXISTS idx_event_outbox_pending_order
  ON event_outbox (created_at ASC, id ASC)
  WHERE published_at IS NULL;

CREATE TABLE IF NOT EXISTS event_outbox_failed (
  id             BIGSERIAL PRIMARY KEY,
  original_id    BIGINT NOT NULL,
  tenant_id      UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  event_id       UUID NOT NULL,
  event_type     TEXT NOT NULL,
  payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts       INTEGER NOT NULL,
  last_error     TEXT,
  failed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE event_outbox_failed IS
  'Dead Letter Queue do event_outbox. '
  'Eventos que excederam max_attempts são movidos aqui para análise manual.';

COMMIT;
