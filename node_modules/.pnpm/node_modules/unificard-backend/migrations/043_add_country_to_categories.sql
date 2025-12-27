-- ============================================
-- 043_add_country_to_categories.sql
-- Adiciona suporte a categorias específicas por país
-- ============================================

-- Adiciona coluna country_code para categorias de educação
-- NULL = categoria global (profissões, interesses)
-- Código ISO do país (ex: 'BR', 'US', 'CN') = categoria específica do país
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) NULL;

-- Índice para busca eficiente por país
CREATE INDEX IF NOT EXISTS idx_categories_country_code ON categories (country_code) WHERE country_code IS NOT NULL;

-- Índice composto para busca por país e contexto (via metadata ou tags)
CREATE INDEX IF NOT EXISTS idx_categories_country_level ON categories (country_code, level) WHERE country_code IS NOT NULL;

COMMENT ON COLUMN categories.country_code IS 'Código ISO do país (ex: BR, US, CN). NULL para categorias globais. Usado principalmente para categorias de educação que variam por país.';


