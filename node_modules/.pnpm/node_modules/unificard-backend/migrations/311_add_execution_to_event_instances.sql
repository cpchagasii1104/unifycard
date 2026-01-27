-- ============================================================
-- UNIFICARD - MIGRATION 311
-- Arquivo: 311_add_execution_to_event_instances.sql
-- Tipo: HUMAN MVP - ACTIVITY EXECUTION
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Adicionar campo executed_at à tabela human_mvp_event_instances
-- Para rastrear execuções e garantir unicidade (uma execução por EventInstance)
--
-- OBJETIVO
-- Permitir registro de execução de atividades vinculadas a EventInstances
-- ============================================================

BEGIN;

-- Adicionar esta migration à tabela schema_migrations
INSERT INTO schema_migrations (version, name, executed_at)
VALUES ('311', 'add_execution_to_event_instances', NOW())
ON CONFLICT (version) DO NOTHING;

-- Adicionar coluna executed_at à tabela human_mvp_event_instances
ALTER TABLE human_mvp_event_instances
ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ;

COMMENT ON COLUMN human_mvp_event_instances.executed_at IS 'Data e hora da execução da atividade (NULL se ainda não executado)';

-- Índice para consultas de execuções
CREATE INDEX IF NOT EXISTS idx_human_mvp_event_instances_executed_at ON human_mvp_event_instances(executed_at) WHERE executed_at IS NOT NULL;

COMMIT;




