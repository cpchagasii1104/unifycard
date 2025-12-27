-- ============================================
-- 044_add_pricing_type_to_user_skills.sql
-- Adiciona campo 'pricing_type' para escolher entre cobrança por hora ou orçamento
-- ============================================

-- Adiciona coluna pricing_type
-- 'hourly' = cobrança por hora (usa hourly_rate)
-- 'quote' = solicitar orçamento primeiro
ALTER TABLE user_skills_categories
ADD COLUMN IF NOT EXISTS pricing_type VARCHAR(20) NOT NULL DEFAULT 'hourly' CHECK (pricing_type IN ('hourly', 'quote'));

-- Adiciona índice para busca eficiente
CREATE INDEX IF NOT EXISTS idx_user_skills_categories_pricing_type ON user_skills_categories (pricing_type);

-- Comentário
COMMENT ON COLUMN user_skills_categories.pricing_type IS 'Tipo de cobrança: hourly (por hora) ou quote (solicitar orçamento)';


