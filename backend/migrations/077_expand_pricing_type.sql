-- ================================================
-- UNIFICARD - MIGRATION 077
-- Expande pricing_type para incluir daily, weekly, monthly
-- ================================================

-- Remove a constraint antiga
ALTER TABLE user_skills_categories
DROP CONSTRAINT IF EXISTS user_skills_categories_pricing_type_check;

-- Adiciona nova constraint com os novos valores
ALTER TABLE user_skills_categories
ADD CONSTRAINT user_skills_categories_pricing_type_check 
CHECK (pricing_type IN ('hourly', 'daily', 'weekly', 'monthly', 'quote'));

-- Atualiza comentário
COMMENT ON COLUMN user_skills_categories.pricing_type IS 'Tipo de cobrança: hourly (por hora), daily (por dia), weekly (por semana), monthly (por mês) ou quote (solicitar orçamento)';


