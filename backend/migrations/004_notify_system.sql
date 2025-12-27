-- 004_notify_system.sql
-- Sistema de notificações (UnifyNotify)

BEGIN;

-- =============================================
-- TABELA: notify_templates
-- =============================================
CREATE TABLE IF NOT EXISTS notify_templates (
  template_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  channel     VARCHAR(32) NOT NULL, -- 'email' | 'sms' | 'push' | 'in_app' | 'webhook'
  name        VARCHAR(128) NOT NULL,
  description TEXT,
  subject     TEXT,        -- para email/push
  body        TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}'::jsonb,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at  TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT uq_notify_templates UNIQUE (tenant_id, channel, name)
);

CREATE INDEX IF NOT EXISTS idx_notify_templates_tenant
  ON notify_templates(tenant_id);

CREATE INDEX IF NOT EXISTS idx_notify_templates_tenant_channel_name
  ON notify_templates(tenant_id, channel, name);

-- =============================================
-- TABELA: notify_queue
-- =============================================
CREATE TABLE IF NOT EXISTS notify_queue (
  notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id         UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,
  channel         VARCHAR(32) NOT NULL, -- 'email' | 'sms' | 'push' | 'webhook' | 'in_app'
  template_name   VARCHAR(128),         -- referencia logical (tenant_id + channel + name)
  target          TEXT NOT NULL,        -- email, phone, device token, url etc
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  status          VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending | processing | sent | failed | canceled
  retry_count     INTEGER NOT NULL DEFAULT 0,
  max_retries     INTEGER NOT NULL DEFAULT 5,
  scheduled_at    TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  sent_at         TIMESTAMP WITHOUT TIME ZONE,
  last_error      TEXT,
  created_at      TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notify_queue_tenant
  ON notify_queue(tenant_id);

CREATE INDEX IF NOT EXISTS idx_notify_queue_tenant_status_scheduled
  ON notify_queue(tenant_id, status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_notify_queue_tenant_user
  ON notify_queue(tenant_id, user_id);

-- =============================================
-- TRIGGER updated_at
-- =============================================
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_templates_updated_at
  BEFORE UPDATE ON notify_templates
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();

CREATE TRIGGER trg_notify_queue_updated_at
  BEFORE UPDATE ON notify_queue
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();

-- =============================================
-- RLS
-- =============================================
ALTER TABLE notify_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notify_queue ENABLE ROW LEVEL SECURITY;

-- Política: tenant só enxerga/insere/atualiza seus próprios registros
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notify_templates'
      AND policyname = 'notify_templates_tenant_isolation'
  ) THEN
    CREATE POLICY notify_templates_tenant_isolation
      ON notify_templates
      USING (tenant_id = current_setting('app.current_tenant')::uuid)
      WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notify_queue'
      AND policyname = 'notify_queue_tenant_isolation'
  ) THEN
    CREATE POLICY notify_queue_tenant_isolation
      ON notify_queue
      USING (tenant_id = current_setting('app.current_tenant')::uuid)
      WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
  END IF;
END;
$$;

COMMIT;
