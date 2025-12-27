-- ============================================
-- 045_expand_professional_services.sql
-- Expande sistema de profissões para incluir serviços/produtos, serviços pré-definidos, etc.
-- ============================================

-- Adiciona coluna service_type (serviço ou produto)
ALTER TABLE user_skills_categories
ADD COLUMN IF NOT EXISTS service_type VARCHAR(20) NOT NULL DEFAULT 'service' CHECK (service_type IN ('service', 'product'));

-- Adiciona coluna charge_visit (se cobra visita para orçamento)
ALTER TABLE user_skills_categories
ADD COLUMN IF NOT EXISTS charge_visit BOOLEAN NOT NULL DEFAULT false;

-- Adiciona coluna visit_price (preço da visita, se cobra)
ALTER TABLE user_skills_categories
ADD COLUMN IF NOT EXISTS visit_price NUMERIC(10,2) NULL;

-- Cria tabela para serviços pré-definidos
CREATE TABLE IF NOT EXISTS predefined_services (
  service_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  global_user_id UUID NOT NULL REFERENCES global_users(global_user_id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  base_price NUMERIC(10,2) NOT NULL,
  discount_percentage NUMERIC(5,2) DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  final_price NUMERIC(10,2) GENERATED ALWAYS AS (base_price * (1 - COALESCE(discount_percentage, 0) / 100)) STORED,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT predefined_services_unique UNIQUE (global_user_id, category_id, name)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_predefined_services_user ON predefined_services (global_user_id);
CREATE INDEX IF NOT EXISTS idx_predefined_services_category ON predefined_services (category_id);
CREATE INDEX IF NOT EXISTS idx_predefined_services_active ON predefined_services (is_active) WHERE is_active = true;

-- Trigger para updated_at (usa função já existente de categories)
CREATE TRIGGER trigger_update_predefined_services_updated_at
  BEFORE UPDATE ON predefined_services
  FOR EACH ROW
  EXECUTE FUNCTION update_categories_updated_at();

-- Comentários
COMMENT ON COLUMN user_skills_categories.service_type IS 'Tipo: service (serviço) ou product (produto)';
COMMENT ON COLUMN user_skills_categories.charge_visit IS 'Se cobra pela visita para fazer orçamento';
COMMENT ON COLUMN user_skills_categories.visit_price IS 'Preço da visita (se charge_visit = true)';
COMMENT ON TABLE predefined_services IS 'Serviços pré-definidos com valores fixos (ex: Trocar chuveiro: R$ 150)';

