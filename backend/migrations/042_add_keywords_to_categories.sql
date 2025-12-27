-- ================================================
-- UNIFICARD - MIGRATION 042
-- Adiciona campo keywords para busca inteligente
-- ================================================

-- Adicionar campo keywords (JSONB) para sinônimos e palavras-chave
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS keywords JSONB DEFAULT '[]'::jsonb;

-- Criar índice GIN para busca rápida em keywords
CREATE INDEX IF NOT EXISTS idx_categories_keywords ON categories USING GIN (keywords);

-- Habilitar extensão pg_trgm para busca fuzzy (similaridade de texto)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Criar índice para busca full-text melhorada (após criar a extensão)
-- Nota: Este índice pode falhar se pg_trgm não estiver disponível, mas não é crítico
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_categories_name_trgm ON categories USING GIN (name gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN
  -- Ignorar erro se gin_trgm_ops não estiver disponível
  RAISE NOTICE 'Índice gin_trgm_ops não criado (não crítico)';
END $$;

-- Comentário
COMMENT ON COLUMN categories.keywords IS 'Array de palavras-chave e sinônimos para busca inteligente (ex: ["marketing digital", "digital marketing", "mkt digital"])';

