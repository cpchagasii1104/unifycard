-- ============================================================
-- UNIFICARD - MIGRATION 309
-- Arquivo: 309_create_human_mvp_opportunities.sql
-- Tipo: HUMAN MVP - OPPORTUNITIES
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Criar tabela de Opportunities do Human MVP
-- Opportunity sempre vinculada a categoria existente
-- Contexts permitidos: professional, person, interest
--
-- OBJETIVO
-- Persistir oportunidades de trabalho/atividade vinculadas a categorias
-- ============================================================

BEGIN;

-- Adicionar esta migration à tabela schema_migrations
INSERT INTO schema_migrations (version, name, executed_at)
VALUES ('309', 'create_human_mvp_opportunities', NOW())
ON CONFLICT (version) DO NOTHING;

-- Criar tabela human_mvp_opportunities
CREATE TABLE IF NOT EXISTS human_mvp_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  category_id UUID NOT NULL,
  context VARCHAR(50) NOT NULL,
  origin_type VARCHAR(20) NOT NULL CHECK (origin_type IN ('person', 'system', 'government')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_context_allowed CHECK (context IN ('professional', 'person', 'interest'))
);

COMMENT ON TABLE human_mvp_opportunities IS 'Oportunidades de trabalho/atividade do Human MVP, vinculadas a categorias';
COMMENT ON COLUMN human_mvp_opportunities.tenant_id IS 'ID do tenant';
COMMENT ON COLUMN human_mvp_opportunities.category_id IS 'ID da categoria (FK para categories)';
COMMENT ON COLUMN human_mvp_opportunities.context IS 'Contexto da categoria (professional, person ou interest)';
COMMENT ON COLUMN human_mvp_opportunities.origin_type IS 'Tipo de origem: person, system ou government';

-- Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_human_mvp_opportunities_tenant_id ON human_mvp_opportunities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_human_mvp_opportunities_category_id ON human_mvp_opportunities(category_id);
CREATE INDEX IF NOT EXISTS idx_human_mvp_opportunities_context ON human_mvp_opportunities(context);
CREATE INDEX IF NOT EXISTS idx_human_mvp_opportunities_origin_type ON human_mvp_opportunities(origin_type);
CREATE INDEX IF NOT EXISTS idx_human_mvp_opportunities_created_at ON human_mvp_opportunities(created_at DESC);

COMMIT;




