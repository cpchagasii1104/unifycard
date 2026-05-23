-- Migration: schedules_revoke_write
-- Referência: DECISION-0014 (C63)

REVOKE INSERT, UPDATE ON schedules FROM PUBLIC;
REVOKE INSERT, UPDATE ON schedule_slots FROM PUBLIC;
