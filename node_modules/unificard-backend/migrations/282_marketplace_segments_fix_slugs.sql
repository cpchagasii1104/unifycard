-- ============================================================
-- UNIFICARD - MIGRATION 282
-- Marketplace Segments: Fix Slugs and Ensure Complete Coverage
-- Garante que todos os domínios tenham segments com slugs corretos para navegação
-- ============================================================

BEGIN;

-- ============================================================
-- ETAPA 1: Atualizar slugs dos segments existentes para formato simplificado
-- Remover prefixos 'market-segment-', 'services-segment-', etc.
-- ============================================================
UPDATE categories
SET slug = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
  slug,
  'market-segment-', ''),
  'services-segment-', ''),
  'events-segment-', ''),
  'real-estate-segment-', ''),
  'vehicles-segment-', ''),
  'jobs-segment-', '')
WHERE metadata->>'category_type' = 'segment'
  AND metadata->>'domain' = 'marketplace'
  AND (slug LIKE 'market-segment-%' 
    OR slug LIKE 'services-segment-%'
    OR slug LIKE 'events-segment-%'
    OR slug LIKE 'real-estate-segment-%'
    OR slug LIKE 'vehicles-segment-%'
    OR slug LIKE 'jobs-segment-%');

-- ============================================================
-- ETAPA 2: Garantir segments completos para cada domínio
-- Criar/atualizar segments com slugs corretos
-- ============================================================

-- DOMÍNIO: market
INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
VALUES
  ('supermercados', 'Supermercados', 'Supermercados e mercados', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "market"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('farmacias', 'Farmácias', 'Farmácias e drogarias', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "market"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('lojas-construcao', 'Lojas de Construção', 'Lojas de material de construção', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "market"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('pet-shops', 'Pet Shops', 'Lojas especializadas em produtos para animais', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "market"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('lojas-moda', 'Lojas de Moda', 'Lojas de roupas e acessórios', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "market"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('lojas-eletronicos', 'Lojas de Eletrônicos', 'Lojas de eletrônicos e informática', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "market"}'::jsonb, 
   NULL, NOW(), NOW())
ON CONFLICT (slug, country_code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- DOMÍNIO: services
INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
VALUES
  ('clinicas-veterinarias', 'Clínicas Veterinárias', 'Clínicas e consultórios veterinários', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "services"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('costureiras', 'Costureiras', 'Profissionais de costura e alfaiataria', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "services"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('eletricistas', 'Eletricistas', 'Profissionais de serviços elétricos', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "services"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('restaurantes', 'Restaurantes', 'Restaurantes e casas de comida', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "services"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('oficinas-mecanicas', 'Oficinas Mecânicas', 'Oficinas e serviços automotivos', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "services"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('saloes-beleza', 'Salões de Beleza', 'Salões de beleza e estética', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "services"}'::jsonb, 
   NULL, NOW(), NOW())
ON CONFLICT (slug, country_code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- DOMÍNIO: events
INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
VALUES
  ('casas-noturnas', 'Casas Noturnas', 'Casas de shows e vida noturna', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "events"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('produtores-eventos', 'Produtores de Eventos', 'Produtores e organizadores de eventos', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "events"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('teatros', 'Teatros', 'Teatros e casas de espetáculo', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "events"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('estadios', 'Estádios', 'Estádios e arenas esportivas', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "events"}'::jsonb, 
   NULL, NOW(), NOW())
ON CONFLICT (slug, country_code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- DOMÍNIO: real_estate
INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
VALUES
  ('imobiliarias', 'Imobiliárias', 'Imobiliárias e corretoras', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "real_estate"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('locacao-temporaria', 'Locação Temporária', 'Locação de imóveis temporária', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "real_estate"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('venda-imoveis', 'Venda de Imóveis', 'Venda de imóveis', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "real_estate"}'::jsonb, 
   NULL, NOW(), NOW())
ON CONFLICT (slug, country_code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- DOMÍNIO: vehicles
INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
VALUES
  ('concessionarias', 'Concessionárias', 'Concessionárias de veículos', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "vehicles"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('locadoras-veiculos', 'Locadoras de Veículos', 'Locadoras de veículos', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "vehicles"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('assinatura-veiculos', 'Assinatura de Veículos', 'Serviços de assinatura de veículos', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "vehicles"}'::jsonb, 
   NULL, NOW(), NOW())
ON CONFLICT (slug, country_code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- DOMÍNIO: jobs
INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
VALUES
  ('empresas-contratantes', 'Empresas Contratantes', 'Empresas que contratam', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "jobs"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('agencias-recrutamento', 'Agências de Recrutamento', 'Agências de recrutamento e seleção', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "jobs"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('vagas-clt', 'Vagas CLT', 'Vagas de emprego CLT', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "jobs"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('freelance', 'Freelance', 'Oportunidades de trabalho freelance', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "jobs"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('temporario', 'Temporário', 'Trabalhos temporários', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "jobs"}'::jsonb, 
   NULL, NOW(), NOW())
ON CONFLICT (slug, country_code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- ============================================================
-- ETAPA 3: Garantir que segments antigos com slugs incorretos sejam atualizados
-- ============================================================
UPDATE categories
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{marketplace_domain}',
  to_jsonb('market'::text),
  true
)
WHERE metadata->>'category_type' = 'segment'
  AND metadata->>'domain' = 'marketplace'
  AND metadata->>'marketplace_domain' IS NULL;

-- ============================================================
-- ETAPA 4: Log de validação
-- ============================================================
DO $$
DECLARE
  market_segments INTEGER;
  services_segments INTEGER;
  events_segments INTEGER;
  real_estate_segments INTEGER;
  vehicles_segments INTEGER;
  jobs_segments INTEGER;
BEGIN
  SELECT COUNT(*) INTO market_segments
  FROM categories
  WHERE metadata->>'category_type' = 'segment'
    AND metadata->>'domain' = 'marketplace'
    AND metadata->>'marketplace_domain' = 'market';
  
  SELECT COUNT(*) INTO services_segments
  FROM categories
  WHERE metadata->>'category_type' = 'segment'
    AND metadata->>'domain' = 'marketplace'
    AND metadata->>'marketplace_domain' = 'services';
  
  SELECT COUNT(*) INTO events_segments
  FROM categories
  WHERE metadata->>'category_type' = 'segment'
    AND metadata->>'domain' = 'marketplace'
    AND metadata->>'marketplace_domain' = 'events';
  
  SELECT COUNT(*) INTO real_estate_segments
  FROM categories
  WHERE metadata->>'category_type' = 'segment'
    AND metadata->>'domain' = 'marketplace'
    AND metadata->>'marketplace_domain' = 'real_estate';
  
  SELECT COUNT(*) INTO vehicles_segments
  FROM categories
  WHERE metadata->>'category_type' = 'segment'
    AND metadata->>'domain' = 'marketplace'
    AND metadata->>'marketplace_domain' = 'vehicles';
  
  SELECT COUNT(*) INTO jobs_segments
  FROM categories
  WHERE metadata->>'category_type' = 'segment'
    AND metadata->>'domain' = 'marketplace'
    AND metadata->>'marketplace_domain' = 'jobs';
  
  RAISE NOTICE 'Segments por domínio:';
  RAISE NOTICE '  market: %', market_segments;
  RAISE NOTICE '  services: %', services_segments;
  RAISE NOTICE '  events: %', events_segments;
  RAISE NOTICE '  real_estate: %', real_estate_segments;
  RAISE NOTICE '  vehicles: %', vehicles_segments;
  RAISE NOTICE '  jobs: %', jobs_segments;
END $$;

COMMIT;



