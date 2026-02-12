/*
Arquivo: 004_notify_system.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Escopo: Sistema de notificações

Objetivo:
- Gerenciar templates de notificação
- Controlar fila de envio multicanal (email, push, etc)

Dependências:
- tenants, users (001_schema_genesis_ssot)

Observações:
- Totalmente orientado a eventos
*/

BEGIN;

-- NOTIFY TEMPLATES
CREATE TABLE IF NOT EXISTS notify_templates (
  template_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel     VARCHAR(32) NOT NULL,
  name        VARCHAR(128) NOT NULL,
  description TEXT,
  subject     TEXT,
  body        TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}'::jsonb,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_notify_templates UNIQUE (tenant_id, channel, name)
);

CREATE INDEX IF NOT EXISTS idx_notify_templates_tenant
  ON notify_templates (tenant_id);

CREATE INDEX IF NOT EXISTS idx_notify_templates_tenant_channel_name
  ON notify_templates (tenant_id, channel, name);

-- NOTIFY QUEUE
CREATE TABLE IF NOT EXISTS notify_queue (
  notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  channel         VARCHAR(32) NOT NULL,
  template_name   VARCHAR(128),
  target          TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  status          VARCHAR(32) NOT NULL DEFAULT 'pending',
  retry_count     INTEGER NOT NULL DEFAULT 0,
  max_retries     INTEGER NOT NULL DEFAULT 5,
  scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at         TIMESTAMPTZ,
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notify_queue_tenant
  ON notify_queue (tenant_id);

CREATE INDEX IF NOT EXISTS idx_notify_queue_tenant_status_scheduled
  ON notify_queue (tenant_id, status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_notify_queue_tenant_user
  ON notify_queue (tenant_id, user_id);

-- UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- TRIGGERS (idempotentes)
DROP TRIGGER IF EXISTS trg_notify_templates_updated_at ON notify_templates;
CREATE TRIGGER trg_notify_templates_updated_at
  BEFORE UPDATE ON notify_templates
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_notify_queue_updated_at ON notify_queue;
CREATE TRIGGER trg_notify_queue_updated_at
  BEFORE UPDATE ON notify_queue
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();

-- ROW LEVEL SECURITY
ALTER TABLE notify_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notify_queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'notify_templates'
      AND policyname = 'notify_templates_tenant_isolation'
  ) THEN
    CREATE POLICY notify_templates_tenant_isolation
      ON notify_templates
      USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = current_schema()
      AND tablename = 'notify_queue'
      AND policyname = 'notify_queue_tenant_isolation'
  ) THEN
    CREATE POLICY notify_queue_tenant_isolation
      ON notify_queue
      USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
  END IF;
END;
$$;

COMMIT;
