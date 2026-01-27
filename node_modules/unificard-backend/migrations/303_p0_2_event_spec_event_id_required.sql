-- ============================================================
-- UNIFICARD - MIGRATION 303
-- P0-2: EventSpec.event_id OBRIGATÓRIO
-- ============================================================
--
-- OBJETIVO:
-- Tornar event_id NOT NULL em event_specs.
-- EventSpec DEVE sempre referenciar um Event existente (draft).
--
-- ⚠️ MIGRATION DESTRUTIVA (DEV/VIRGEM):
-- Sistema está virgem (sem dados), então é seguro remover EventSpecs sem event_id.
-- Se houver EventSpecs órfãos, eles serão removidos.
--
-- REGRAS:
-- - EventSpec NUNCA cria Event
-- - EventSpec APENAS referencia Event existente (draft)
-- - Todo fluxo de aniversário tem Event draft antes do Spec
--
-- ============================================================

-- ============================================================
-- REMOVER EventSpecs ÓRFÃOS (sem event_id)
-- ============================================================
-- Como sistema está virgem, podemos remover EventSpecs sem event_id
DELETE FROM event_specs WHERE event_id IS NULL;

-- ============================================================
-- TORNAR event_id NOT NULL
-- ============================================================
ALTER TABLE event_specs
  ALTER COLUMN event_id SET NOT NULL;

-- ============================================================
-- ATUALIZAR FOREIGN KEY CONSTRAINT
-- ============================================================
-- Remover constraint antiga (se existir)
ALTER TABLE event_specs
  DROP CONSTRAINT IF EXISTS event_specs_event_id_fkey;

-- Adicionar constraint nova (NOT NULL + FK)
ALTER TABLE event_specs
  ADD CONSTRAINT event_specs_event_id_fkey
    FOREIGN KEY (event_id)
    REFERENCES events(id)
    ON DELETE CASCADE; -- Se evento for deletado, EventSpec também é deletado

-- ============================================================
-- ATUALIZAR ÍNDICE
-- ============================================================
-- Remover índice parcial antigo (WHERE event_id IS NOT NULL)
DROP INDEX IF EXISTS idx_event_specs_event_id;

-- Criar índice normal (event_id sempre existe agora)
CREATE INDEX IF NOT EXISTS idx_event_specs_event_id
  ON event_specs(event_id);

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON COLUMN event_specs.event_id IS 
  'ID do evento associado (OBRIGATÓRIO). EventSpec sempre referencia um Event existente (draft).';

