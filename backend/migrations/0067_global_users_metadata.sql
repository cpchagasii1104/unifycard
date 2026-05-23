-- ============================================================
-- 0067: global_users.metadata + índice GIN (inferência / histórico)
-- ============================================================
-- Alinha com profile-inference.service (SELECT/UPDATE metadata).
-- ADD COLUMN IF NOT EXISTS: no-op se 0058 já criou metadata.
-- ============================================================

BEGIN;

ALTER TABLE global_users
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_global_users_metadata
  ON global_users USING GIN (metadata);

COMMIT;
