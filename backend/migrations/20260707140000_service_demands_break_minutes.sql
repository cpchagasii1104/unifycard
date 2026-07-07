-- 20260707140000: DECISION-0164 — intervalo na jornada da demanda (Clayton: "com ou sem
-- intervalo, na sequência lógica"). NULL = jornada direta; valor = minutos de intervalo.
BEGIN;
ALTER TABLE service_demands ADD COLUMN IF NOT EXISTS break_minutes INT DEFAULT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_service_demands_break_minutes') THEN
    ALTER TABLE service_demands ADD CONSTRAINT chk_service_demands_break_minutes
      CHECK (break_minutes IS NULL OR break_minutes > 0);
  END IF;
END $$;
COMMIT;
