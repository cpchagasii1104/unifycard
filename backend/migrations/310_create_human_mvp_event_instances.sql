-- ============================================================
-- UNIFICARD - MIGRATION 310
-- Arquivo: 310_create_human_mvp_event_instances.sql
-- Tipo: HUMAN MVP - EVENT INSTANCES
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Criar tabela de EventInstances do Human MVP
-- EventInstance sempre derivado de MATCH_FOUND aceito
-- Data e hora DEVEM ser informadas explicitamente
--
-- OBJETIVO
-- Persistir instâncias de eventos agendados vinculadas a Opportunities e pessoas
-- ============================================================

BEGIN;

-- Adicionar esta migration à tabela schema_migrations
INSERT INTO schema_migrations (version, name, executed_at)
VALUES ('310', 'create_human_mvp_event_instances', NOW())
ON CONFLICT (version) DO NOTHING;

-- Criar tabela human_mvp_event_instances
CREATE TABLE IF NOT EXISTS human_mvp_event_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  opportunity_id UUID NOT NULL REFERENCES human_mvp_opportunities(id) ON DELETE CASCADE,
  person_id UUID NOT NULL,
  category_id UUID NOT NULL,
  context VARCHAR(50) NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_context_allowed CHECK (context IN ('professional', 'person', 'interest'))
);

COMMENT ON TABLE human_mvp_event_instances IS 'Instâncias de eventos agendados do Human MVP, derivadas de MATCH_FOUND aceito';
COMMENT ON COLUMN human_mvp_event_instances.tenant_id IS 'ID do tenant';
COMMENT ON COLUMN human_mvp_event_instances.opportunity_id IS 'ID da Opportunity (FK para human_mvp_opportunities)';
COMMENT ON COLUMN human_mvp_event_instances.person_id IS 'ID da pessoa que aceitou o match';
COMMENT ON COLUMN human_mvp_event_instances.category_id IS 'ID da categoria (herdado da Opportunity)';
COMMENT ON COLUMN human_mvp_event_instances.context IS 'Contexto da categoria (herdado da Opportunity)';
COMMENT ON COLUMN human_mvp_event_instances.scheduled_at IS 'Data e hora agendada do evento (obrigatória)';

-- Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_human_mvp_event_instances_tenant_id ON human_mvp_event_instances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_human_mvp_event_instances_opportunity_id ON human_mvp_event_instances(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_human_mvp_event_instances_person_id ON human_mvp_event_instances(person_id);
CREATE INDEX IF NOT EXISTS idx_human_mvp_event_instances_category_id ON human_mvp_event_instances(category_id);
CREATE INDEX IF NOT EXISTS idx_human_mvp_event_instances_scheduled_at ON human_mvp_event_instances(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_human_mvp_event_instances_context ON human_mvp_event_instances(context);

COMMIT;




