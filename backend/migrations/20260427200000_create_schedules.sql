-- F-MIGRATION-REBUILD-PACKAGES Pacote 1
-- Backdated CREATE de schedules para que o REVOKE em
-- 20260428200000_schedules_revoke_write.sql não falhe no rebuild zero.
--
-- Idempotência: IF NOT EXISTS. Banco vivo: já existe → no-op. Rebuild zero:
-- cria antes do REVOKE; original 20260530200000_schedules.sql vira no-op
-- via IF NOT EXISTS; chk_schedules_status vem de 20260530535000 sem conflito.

CREATE TABLE IF NOT EXISTS schedules (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id),
  actor_id        UUID        REFERENCES actors(id),
  reference_type  TEXT,
  reference_id    UUID,
  status          TEXT        NOT NULL DEFAULT 'active',
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
