-- ============================================================
-- UNIFICARD - MIGRATION 307
-- Arquivo: 307_create_human_mvp_events.sql
-- Tipo: HUMAN MVP - EVENTOS
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Criar tabela de eventos do Human MVP para rastreabilidade completa
-- conforme HUMAN-MVP-FLOWS.md
--
-- OBJETIVO
-- Persistir todos os eventos do Human MVP:
-- - SKILL_CREATED
-- - SERVICE_OFFER_CREATED
-- - OPPORTUNITY_PUBLISHED
-- - MATCH_FOUND
-- - EVENT_SCHEDULED
-- - ACTIVITY_EXECUTED
-- ============================================================

BEGIN;

-- Adicionar esta migration à tabela schema_migrations
INSERT INTO schema_migrations (version, name, executed_at)
VALUES ('307', 'create_human_mvp_events', NOW())
ON CONFLICT (version) DO NOTHING;

-- Criar tabela human_mvp_events
CREATE TABLE IF NOT EXISTS human_mvp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  tenant_id UUID NOT NULL,
  person_id UUID,
  category_id UUID,
  context VARCHAR(50),
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE human_mvp_events IS 'Eventos do Human MVP para rastreabilidade completa';
COMMENT ON COLUMN human_mvp_events.event_type IS 'Tipo do evento (SKILL_CREATED, SERVICE_OFFER_CREATED, etc)';
COMMENT ON COLUMN human_mvp_events.tenant_id IS 'ID do tenant';
COMMENT ON COLUMN human_mvp_events.person_id IS 'ID da pessoa (quando aplicável)';
COMMENT ON COLUMN human_mvp_events.category_id IS 'ID da categoria (quando aplicável)';
COMMENT ON COLUMN human_mvp_events.context IS 'Contexto da categoria (quando aplicável)';
COMMENT ON COLUMN human_mvp_events.details IS 'Detalhes adicionais do evento (JSONB)';

-- Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_human_mvp_events_event_type ON human_mvp_events(event_type);
CREATE INDEX IF NOT EXISTS idx_human_mvp_events_tenant_id ON human_mvp_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_human_mvp_events_person_id ON human_mvp_events(person_id) WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_human_mvp_events_category_id ON human_mvp_events(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_human_mvp_events_created_at ON human_mvp_events(created_at DESC);

COMMIT;




