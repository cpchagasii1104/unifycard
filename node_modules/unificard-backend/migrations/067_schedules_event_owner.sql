-- ============================================================
-- UNIFICARD — MIGRATION 067
-- Arquivo: 067_schedule_event_owner.sql
-- Tipo: EVOLUÇÃO ESTRUTURAL (novo tipo de owner)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- O sistema de agendas (schedules) do Unificard é baseado
-- em ownership explícito: cada agenda pertence a exatamente
-- UM owner lógico.
--
-- Até a migration 063, os owners suportados eram:
-- • usuário
-- • empresa
-- • serviço
--
-- Esta migration introduz eventos como um novo tipo de owner,
-- permitindo agendas específicas para eventos.
--
-- OBJETIVO
-- • Adicionar event_id como owner possível de schedules
-- • Garantir unicidade de agenda por evento
-- • Manter a regra estrutural: exatamente 1 owner por schedule
--
-- DECISÕES IMPORTANTES
-- • Ownership é validado via CHECK constraint
-- • O banco NÃO valida semântica de eventos
-- • A aplicação define quando usar schedule por evento
--
-- DEPENDÊNCIAS
-- • schedules
-- • events (tabela deve existir antes desta migration)
--
-- IDEMPOTÊNCIA
-- • Todas as alterações usam IF NOT EXISTS ou guards
--
-- ============================================================


-- ============================================================
-- 1) ADICIONAR EVENT_ID
-- ============================================================

ALTER TABLE schedules
ADD COLUMN IF NOT EXISTS event_id UUID;


-- ============================================================
-- 2) FOREIGN KEY PARA EVENTS (COM GUARD)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_schedules_event'
      AND conrelid = 'schedules'::regclass
  ) THEN
    ALTER TABLE schedules
      ADD CONSTRAINT fk_schedules_event
      FOREIGN KEY (event_id)
      REFERENCES events(id)
      ON DELETE CASCADE;
  END IF;
END $$;


-- ============================================================
-- 3) ATUALIZAR CONSTRAINT DE OWNER (EXATAMENTE 1)
-- ============================================================

ALTER TABLE schedules
DROP CONSTRAINT IF EXISTS schedules_owner_check;

ALTER TABLE schedules
ADD CONSTRAINT schedules_owner_check CHECK (
  (
    (global_user_id IS NOT NULL)::int +
    (company_id IS NOT NULL)::int +
    (service_id IS NOT NULL)::int +
    (event_id IS NOT NULL)::int
  ) = 1
);


-- ============================================================
-- 4) ÍNDICES E UNICIDADE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_schedules_event_id
  ON schedules (event_id)
  WHERE event_id IS NOT NULL;

-- Uma agenda por evento
CREATE UNIQUE INDEX IF NOT EXISTS uniq_schedule_event
  ON schedules (event_id)
  WHERE event_id IS NOT NULL;


-- ============================================================
-- FIM 067_schedule_event_owner.sql
-- ============================================================























