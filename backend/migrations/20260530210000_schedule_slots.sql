-- Migration: schedule_slots
-- Forward-only, sem DROP
-- Depende de: schedules (20260530200000)

CREATE TABLE IF NOT EXISTS schedule_slots (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id  UUID        NOT NULL REFERENCES schedules(id),
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'available',
  metadata     JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
