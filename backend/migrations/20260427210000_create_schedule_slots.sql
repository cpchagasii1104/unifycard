-- F-MIGRATION-REBUILD-PACKAGES Pacote 1
-- Backdated CREATE de schedule_slots para que o REVOKE em
-- 20260428200000_schedules_revoke_write.sql não falhe no rebuild zero.
--
-- Depende de schedules (criada em 20260427200000_create_schedules.sql).
-- Idempotência: IF NOT EXISTS. Banco vivo: já existe → no-op. Rebuild zero:
-- cria antes do REVOKE; original 20260530210000_schedule_slots.sql vira no-op;
-- chk_schedule_slots_status vem de 20260530535000 sem conflito.

CREATE TABLE IF NOT EXISTS schedule_slots (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id  UUID        NOT NULL REFERENCES schedules(id),
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'available',
  metadata     JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
