-- ============================================================
-- UNIFICARD - MIGRATION 308
-- Arquivo: 308_create_human_mvp_service_offers.sql
-- Tipo: HUMAN MVP - SERVICE OFFERS
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Criar tabela de ServiceOffers do Human MVP
-- ServiceOffer sempre vinculada a Skill existente
-- Context obrigatório: professional
--
-- OBJETIVO
-- Persistir ofertas de serviço executáveis vinculadas a Skills
-- ============================================================

BEGIN;

-- Adicionar esta migration à tabela schema_migrations
INSERT INTO schema_migrations (version, name, executed_at)
VALUES ('308', 'create_human_mvp_service_offers', NOW())
ON CONFLICT (version) DO NOTHING;

-- Criar tabela human_mvp_service_offers
CREATE TABLE IF NOT EXISTS human_mvp_service_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  person_id UUID NOT NULL,
  skill_id UUID NOT NULL REFERENCES user_skills_categories(id) ON DELETE CASCADE,
  category_id UUID NOT NULL, -- Herdado da Skill, não redefinível
  context VARCHAR(50) NOT NULL DEFAULT 'professional',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_context_professional CHECK (context = 'professional')
);

COMMENT ON TABLE human_mvp_service_offers IS 'Ofertas de serviço executáveis do Human MVP, vinculadas a Skills';
COMMENT ON COLUMN human_mvp_service_offers.tenant_id IS 'ID do tenant';
COMMENT ON COLUMN human_mvp_service_offers.person_id IS 'ID da pessoa que oferece o serviço';
COMMENT ON COLUMN human_mvp_service_offers.skill_id IS 'ID da Skill (FK para user_skills_categories)';
COMMENT ON COLUMN human_mvp_service_offers.category_id IS 'ID da categoria (herdado da Skill, não redefinível)';
COMMENT ON COLUMN human_mvp_service_offers.context IS 'Contexto obrigatório: professional';

-- Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_human_mvp_service_offers_tenant_id ON human_mvp_service_offers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_human_mvp_service_offers_person_id ON human_mvp_service_offers(person_id);
CREATE INDEX IF NOT EXISTS idx_human_mvp_service_offers_skill_id ON human_mvp_service_offers(skill_id);
CREATE INDEX IF NOT EXISTS idx_human_mvp_service_offers_category_id ON human_mvp_service_offers(category_id);
CREATE INDEX IF NOT EXISTS idx_human_mvp_service_offers_created_at ON human_mvp_service_offers(created_at DESC);

COMMIT;




