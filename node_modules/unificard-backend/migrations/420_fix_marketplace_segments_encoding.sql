-- ============================================================
-- UNIFICARD - MIGRATION 284
-- Marketplace Segments: Correção de Encoding UTF-8
-- Corrige textos quebrados nos segments do domínio 'market'
-- ============================================================

BEGIN;

-- ============================================================
-- ETAPA 1: Garantir encoding UTF-8 na sessão
-- ============================================================
SET client_encoding = 'UTF8';

-- ============================================================
-- ETAPA 2: Corrigir nomes dos segments do domínio 'market'
-- Atualiza APENAS os segments que têm encoding quebrado
-- ============================================================

-- Supermercados
UPDATE categories
SET 
  name = 'Supermercados',
  description = 'Supermercados e mercados',
  updated_at = NOW()
WHERE slug = 'supermercados'
  AND country_code = 'BR'
  AND metadata->>'category_type' = 'segment'
  AND metadata->>'marketplace_domain' = 'market'
  AND (name != 'Supermercados' OR name IS NULL);

-- Farmácias
UPDATE categories
SET 
  name = 'Farmácias',
  description = 'Farmácias e drogarias',
  updated_at = NOW()
WHERE slug = 'farmacias'
  AND country_code = 'BR'
  AND metadata->>'category_type' = 'segment'
  AND metadata->>'marketplace_domain' = 'market'
  AND (name != 'Farmácias' OR name IS NULL);

-- Lojas de Construção
UPDATE categories
SET 
  name = 'Lojas de Construção',
  description = 'Lojas de material de construção',
  updated_at = NOW()
WHERE slug = 'lojas-construcao'
  AND country_code = 'BR'
  AND metadata->>'category_type' = 'segment'
  AND metadata->>'marketplace_domain' = 'market'
  AND (name != 'Lojas de Construção' OR name IS NULL);

-- Pet Shops
UPDATE categories
SET 
  name = 'Pet Shops',
  description = 'Lojas especializadas em produtos para animais',
  updated_at = NOW()
WHERE slug = 'pet-shops'
  AND country_code = 'BR'
  AND metadata->>'category_type' = 'segment'
  AND metadata->>'marketplace_domain' = 'market'
  AND (name != 'Pet Shops' OR name IS NULL);

-- Moda
UPDATE categories
SET 
  name = 'Moda',
  description = 'Lojas de roupas e acessórios',
  updated_at = NOW()
WHERE slug = 'moda'
  AND country_code = 'BR'
  AND metadata->>'category_type' = 'segment'
  AND metadata->>'marketplace_domain' = 'market'
  AND (name != 'Moda' OR name IS NULL);

-- Eletrônicos
UPDATE categories
SET 
  name = 'Eletrônicos',
  description = 'Lojas de eletrônicos e informática',
  updated_at = NOW()
WHERE slug = 'eletronicos'
  AND country_code = 'BR'
  AND metadata->>'category_type' = 'segment'
  AND metadata->>'marketplace_domain' = 'market'
  AND (name != 'Eletrônicos' OR name IS NULL);

-- ============================================================
-- ETAPA 3: Validação automática
-- ============================================================
DO $$
DECLARE
  segments_count INTEGER;
  encoding_ok_count INTEGER;
BEGIN
  -- Contar segments do market
  SELECT COUNT(*) INTO segments_count
  FROM categories
  WHERE metadata->>'category_type' = 'segment'
    AND metadata->>'marketplace_domain' = 'market'
    AND country_code = 'BR'
    AND parent_id IS NULL;
  
  -- Contar segments com nomes corretos (UTF-8)
  SELECT COUNT(*) INTO encoding_ok_count
  FROM categories
  WHERE metadata->>'category_type' = 'segment'
    AND metadata->>'marketplace_domain' = 'market'
    AND country_code = 'BR'
    AND parent_id IS NULL
    AND name IN ('Supermercados', 'Farmácias', 'Lojas de Construção', 'Pet Shops', 'Moda', 'Eletrônicos');
  
  RAISE NOTICE 'Total de segments do market: %', segments_count;
  RAISE NOTICE 'Segments com encoding correto: %', encoding_ok_count;
  
  IF encoding_ok_count < segments_count THEN
    RAISE WARNING 'Atenção: % segment(s) ainda com encoding incorreto', (segments_count - encoding_ok_count);
  ELSE
    RAISE NOTICE '✅ Todos os segments estão com encoding UTF-8 correto';
  END IF;
END $$;

COMMIT;

-- ============================================================
-- VALIDAÇÃO MANUAL (executar após a migration)
-- ============================================================
-- SELECT 
--   slug,
--   name,
--   description,
--   metadata->>'category_type' as category_type,
--   metadata->>'marketplace_domain' as marketplace_domain
-- FROM categories
-- WHERE metadata->>'category_type' = 'segment'
--   AND metadata->>'marketplace_domain' = 'market'
--   AND country_code = 'BR'
--   AND parent_id IS NULL
-- ORDER BY slug;
--
-- RESULTADO ESPERADO:
-- slug              | name                  | description
-- ------------------+-----------------------+----------------------------------------
-- eletronicos       | Eletrônicos          | Lojas de eletrônicos e informática
-- farmacias         | Farmácias            | Farmácias e drogarias
-- lojas-construcao  | Lojas de Construção  | Lojas de material de construção
-- moda              | Moda                 | Lojas de roupas e acessórios
-- pet-shops         | Pet Shops            | Lojas especializadas em produtos para animais
-- supermercados     | Supermercados        | Supermercados e mercados



