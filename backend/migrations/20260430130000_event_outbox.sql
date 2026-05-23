-- Outbox transacional mínimo: eventos só são entregues após commit; worker publica com idempotência (event_id).

BEGIN;

CREATE TABLE IF NOT EXISTS event_outbox (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  event_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  CONSTRAINT event_outbox_event_id_uk UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_outbox_pending_created
  ON event_outbox (created_at ASC)
  WHERE published_at IS NULL;

COMMENT ON TABLE event_outbox IS
  'Fila outbox: INSERT na mesma transação que o efeito; worker chama EventBus após commit (idempotência por event_id / event_log).';

COMMIT;
