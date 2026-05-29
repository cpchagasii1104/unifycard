-- F-MIGRATION-REBUILD-PACKAGES Pacote 1
-- Rename forward-only de event_attendees.check_in_time → checked_in_at,
-- agendado APÓS o CREATE original 20260530150000_event_attendees.sql.
--
-- Por que isso é necessário no rebuild:
-- O CREATE original cria a coluna com nome LEGADO (check_in_time). A migration
-- 20260428280000_event_attendees_fix_check_in_time.sql (timestamp anterior por filename)
-- roda ANTES do CREATE no rebuild alfabético → IF EXISTS column 'check_in_time' = FALSE
-- → no-op silencioso → coluna fica legada → diverge do real (que tem checked_in_at).
-- Esta migration corrige forward-only logo após o CREATE.
--
-- Idempotência: DO $$ com IF EXISTS column legada AND NOT EXISTS column moderna.
-- Banco vivo (já tem checked_in_at, não tem check_in_time): no-op total.
-- Rebuild zero: CREATE original deixa check_in_time → este RENAME efetiva → fica checked_in_at.

BEGIN;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'event_attendees'
      AND column_name  = 'check_in_time'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'event_attendees'
      AND column_name  = 'checked_in_at'
  ) THEN
    ALTER TABLE event_attendees RENAME COLUMN check_in_time TO checked_in_at;
  END IF;
END $$;

COMMIT;
