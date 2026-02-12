-- ============================================================
-- UNIFICARD — SERVIÇOS DOMAIN
-- Arquivo: 136_services_domain.sql
-- Banco alvo: PostgreSQL 14+
--
-- OBJETIVO
-- Criar o domínio de SERVIÇOS como entidade econômica viva
-- Serviço NÃO é post, NÃO é categoria, NÃO é agenda
-- Serviço é um objeto de domínio que pode gerar ações reais
--
-- REGRAS OBRIGATÓRIAS
-- * Serviço pertence a um Actor (user, page ou group)
-- * Serviço NÃO decide nada sozinho
-- * Serviço NÃO faz matching automático
-- * Serviço NÃO executa pagamento direto
-- * Serviço NÃO cria score
-- * Serviço pode ser ativado/desativado
-- * Serviço pode ter categoria (scope adequado)
-- * Serviço nasce de intents específicas (ex: OFFER_SERVICE)
--
-- ============================================================

BEGIN;

-- ============================================================
-- ENUMS CANÔNICOS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_type') THEN
    CREATE TYPE service_type AS ENUM (
      'service',    -- Serviço genérico
      'rental',     -- Aluguel/locação
      'event',      -- Evento (serviço de evento)
      'job'         -- Vaga de trabalho (serviço de contratação)
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_status') THEN
    CREATE TYPE service_status AS ENUM (
      'draft',      -- Rascunho (não visível)
      'active',     -- Ativo (visível e disponível)
      'paused'      -- Pausado (visível mas não disponível)
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: SERVICES
-- ============================================================

CREATE TABLE IF NOT EXISTS services (
  service_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Relacionamento com Actor (OBRIGATÓRIO)
  -- 🔴 BLINDAGEM: Nenhum service deve ser criado sem actor
  actor_id UUID NOT NULL REFERENCES actors(actor_id) ON DELETE CASCADE,
  
  -- Identidade do Serviço
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,
  short_description VARCHAR(500), -- Descrição curta para listagens
  
  -- Tipo e Status
  service_type service_type NOT NULL DEFAULT 'service',
  status service_status NOT NULL DEFAULT 'draft',
  
  -- Categoria (opcional, scope adequado)
  -- 🔴 BLINDAGEM: Categoria é contexto, não decisão
  category_id UUID REFERENCES categories(category_id) ON DELETE SET NULL,
  
  -- Preço e Monetização (opcional, não executa pagamento direto)
  -- 🔴 BLINDAGEM: Serviço NÃO executa pagamento direto
  price_cents INTEGER, -- Preço em centavos (ex: 10000 = R$ 100,00)
  currency VARCHAR(3) DEFAULT 'BRL',
  pricing_type VARCHAR(50), -- 'hourly', 'daily', 'weekly', 'monthly', 'fixed', 'quote'
  
  -- Localização (opcional)
  country_id UUID REFERENCES countries(country_id) ON DELETE SET NULL,
  state_id UUID REFERENCES states(state_id) ON DELETE SET NULL,
  city_id UUID REFERENCES cities(city_id) ON DELETE SET NULL,
  neighborhood VARCHAR(255),
  
  -- Metadados e Extensibilidade
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ, -- Quando foi ativado pela primeira vez
  
  -- Constraints
  CONSTRAINT services_unique_slug_per_actor UNIQUE (tenant_id, actor_id, slug),
  CONSTRAINT services_price_positive CHECK (price_cents IS NULL OR price_cents >= 0)
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_services_actor_id ON services(actor_id);
CREATE INDEX IF NOT EXISTS idx_services_tenant_id ON services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_services_status ON services(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_services_category_id ON services(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_services_service_type ON services(service_type);
CREATE INDEX IF NOT EXISTS idx_services_city_id ON services(city_id) WHERE city_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_services_slug ON services(slug);

-- ============================================================
-- TRIGGER: UPDATE updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_services_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION update_services_updated_at();

-- ============================================================
-- TRIGGER: SET activated_at quando status muda para 'active'
-- ============================================================

CREATE OR REPLACE FUNCTION set_services_activated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Se status mudou para 'active' e activated_at ainda é NULL, definir
  IF NEW.status = 'active' AND OLD.status != 'active' AND NEW.activated_at IS NULL THEN
    NEW.activated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_services_activated_at
  BEFORE UPDATE ON services
  FOR EACH ROW
  WHEN (NEW.status = 'active' AND OLD.status != 'active')
  EXECUTE FUNCTION set_services_activated_at();

COMMIT;

-- ============================================================
-- FIM 136_services_domain.sql
-- ============================================================

