-- ============================================================
-- UNIFICARD - MIGRATION 283
-- Marketplace Segments: Seed Segments Canônicos para Market
-- Garante que o domínio 'market' tenha segments válidos
-- ============================================================

BEGIN;

-- ============================================================
-- Inserir segments canônicos para domínio 'market'
-- Idempotente: apenas insere se não existirem
-- ============================================================

INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
SELECT 'supermercados', 'Supermercados', 'Supermercados e mercados', NULL, 'global', true, 
   '{"category_type": "segment", "marketplace_domain": "market", "domain": "marketplace", "taxonomy": "department"}'::jsonb, 
   'BR', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM categories 
  WHERE slug = 'supermercados' AND country_code = 'BR'
);

INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
SELECT 'farmacias', 'Farmácias', 'Farmácias e drogarias', NULL, 'global', true, 
   '{"category_type": "segment", "marketplace_domain": "market", "domain": "marketplace", "taxonomy": "department"}'::jsonb, 
   'BR', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM categories 
  WHERE slug = 'farmacias' AND country_code = 'BR'
);

INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
SELECT 'lojas-construcao', 'Lojas de Construção', 'Lojas de material de construção', NULL, 'global', true, 
   '{"category_type": "segment", "marketplace_domain": "market", "domain": "marketplace", "taxonomy": "department"}'::jsonb, 
   'BR', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM categories 
  WHERE slug = 'lojas-construcao' AND country_code = 'BR'
);

INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
SELECT 'pet-shops', 'Pet Shops', 'Lojas especializadas em produtos para animais', NULL, 'global', true, 
   '{"category_type": "segment", "marketplace_domain": "market", "domain": "marketplace", "taxonomy": "department"}'::jsonb, 
   'BR', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM categories 
  WHERE slug = 'pet-shops' AND country_code = 'BR'
);

INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
SELECT 'moda', 'Moda', 'Lojas de roupas e acessórios', NULL, 'global', true, 
   '{"category_type": "segment", "marketplace_domain": "market", "domain": "marketplace", "taxonomy": "department"}'::jsonb, 
   'BR', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM categories 
  WHERE slug = 'moda' AND country_code = 'BR'
);

INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
SELECT 'eletronicos', 'Eletrônicos', 'Lojas de eletrônicos e informática', NULL, 'global', true, 
   '{"category_type": "segment", "marketplace_domain": "market", "domain": "marketplace", "taxonomy": "department"}'::jsonb, 
   'BR', NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM categories 
  WHERE slug = 'eletronicos' AND country_code = 'BR'
);

COMMIT;
