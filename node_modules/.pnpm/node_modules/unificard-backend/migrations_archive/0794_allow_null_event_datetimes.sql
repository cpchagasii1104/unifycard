-- FASE 5: permitir rascunho sem datas

-- 1. Remover constraint antiga
ALTER TABLE events
DROP CONSTRAINT IF EXISTS events_datetime_check;

-- 2. Permitir NULL
ALTER TABLE events
ALTER COLUMN datetime_start DROP NOT NULL;

ALTER TABLE events
ALTER COLUMN datetime_end DROP NOT NULL;

-- 3. Recriar constraint de forma condicional
ALTER TABLE events
ADD CONSTRAINT events_datetime_check
CHECK (
  datetime_start IS NULL
  OR datetime_end IS NULL
  OR datetime_end > datetime_start
);
