-- ============================================================
-- UNIFICARD - MIGRATION 299
-- FASE 5: Permitir NULL em colunas legadas de tempo
-- ============================================================
--
-- CONTEXTO:
-- A migration 026 criou a tabela events com colunas start_time e end_time
-- como NOT NULL. A migration 090 adicionou datetime_start e datetime_end.
-- A migration 297 tornou datetime_start e datetime_end NULLable.
--
-- PROBLEMA:
-- O INSERT falha porque start_time e end_time ainda são NOT NULL,
-- mesmo que o código FASE 5 não use essas colunas.
--
-- SOLUÇÃO:
-- Tornar start_time e end_time NULLable para permitir criação de
-- rascunhos na FASE 5 (ETAPA 0) que não possuem datas definidas.
--
-- CONFORMIDADE:
-- - EVENT_DOMAIN_MINIMUM_CONTRACT: datas são declaração, não obrigação
-- - AGENDA_UNIVERSAL_CONTRACT: evento não cria agenda paralela
-- - LEGADO_TEMPORAL_MIGRATION_PLAN: compatibilidade com fluxo legado
-- ============================================================

-- 1. Remover constraint legada de tempo (se existir)
ALTER TABLE events
DROP CONSTRAINT IF EXISTS events_time_check;

-- 2. Tornar colunas legadas NULLable
ALTER TABLE events
ALTER COLUMN start_time DROP NOT NULL;

ALTER TABLE events
ALTER COLUMN end_time DROP NOT NULL;

-- 3. Recriar constraint de forma condicional (aceita NULL)
ALTER TABLE events
ADD CONSTRAINT events_time_check
CHECK (
  start_time IS NULL
  OR end_time IS NULL
  OR end_time > start_time
);

-- 4. Comentários para documentação
COMMENT ON COLUMN events.start_time IS
  'LEGADO: Hora de início do evento. Nullable para FASE 5. Usar datetime_start preferencialmente.';

COMMENT ON COLUMN events.end_time IS
  'LEGADO: Hora de fim do evento. Nullable para FASE 5. Usar datetime_end preferencialmente.';
