-- ============================================================
-- UNIFICARD - MIGRATION 281
-- Marketplace Reorganize: Segments vs Offer Categories
-- Separação definitiva entre segmentos (tipo de empresa) e categorias de oferta
-- ============================================================

BEGIN;

-- ============================================================
-- ETAPA 1: Identificar e marcar departments como 'offer_category'
-- Departments genéricos (Pet, Moda, Alimentação, etc.) são categorias de oferta
-- ============================================================
UPDATE categories
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{category_type}',
  '"offer_category"',
  true
)
WHERE metadata->>'domain' = 'marketplace'
  AND metadata->>'taxonomy' = 'department'
  AND parent_id IS NULL
  AND metadata->>'category_type' IS NULL
  AND slug IN (
    'pet',
    'moda-acessorios',
    'alimentacao-bebidas',
    'farmacia-saude',
    'casa-decoracao',
    'eletronicos-informatica',
    'automotivo',
    'construcao-ferramentas',
    'papelaria-escritorio',
    'agro-jardim',
    'imoveis'
  );

-- ============================================================
-- ETAPA 2: Criar segmentos reais por domínio
-- Segmentos representam TIPO DE EMPRESA, não categoria de produto
-- ============================================================

-- DOMÍNIO: market
INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
VALUES
  ('market-segment-supermercado', 'Supermercado', 'Supermercados e mercados', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "market"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('market-segment-farmacia', 'Farmácia', 'Farmácias e drogarias', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "market"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('market-segment-construcao', 'Loja de Construção', 'Lojas de material de construção', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "market"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('market-segment-pet-shop', 'Pet Shop', 'Lojas especializadas em produtos para animais', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "market"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('market-segment-moda', 'Loja de Moda', 'Lojas de roupas e acessórios', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "market"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('market-segment-eletronicos', 'Loja de Eletrônicos', 'Lojas de eletrônicos e informática', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "market"}'::jsonb, 
   NULL, NOW(), NOW())
ON CONFLICT (slug, country_code) DO UPDATE SET
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- DOMÍNIO: services
INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
VALUES
  ('services-segment-veterinaria', 'Clínica Veterinária', 'Clínicas e consultórios veterinários', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "services"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('services-segment-costureira', 'Costureira', 'Profissionais de costura e alfaiataria', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "services"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('services-segment-eletricista', 'Eletricista', 'Profissionais de serviços elétricos', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "services"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('services-segment-restaurante', 'Restaurante', 'Restaurantes e casas de comida', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "services"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('services-segment-oficina', 'Oficina Mecânica', 'Oficinas e serviços automotivos', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "services"}'::jsonb, 
   NULL, NOW(), NOW())
ON CONFLICT (slug, country_code) DO UPDATE SET
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- DOMÍNIO: events
INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
VALUES
  ('events-segment-casa-noturna', 'Casa Noturna', 'Casas de shows e vida noturna', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "events"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('events-segment-produtor', 'Produtor de Eventos', 'Produtores e organizadores de eventos', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "events"}'::jsonb, 
   NULL, NOW(), NOW())
ON CONFLICT (slug, country_code) DO UPDATE SET
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- DOMÍNIO: real_estate
INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
VALUES
  ('real-estate-segment-imobiliaria', 'Imobiliária', 'Imobiliárias e corretoras', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "real_estate"}'::jsonb, 
   NULL, NOW(), NOW())
ON CONFLICT (slug, country_code) DO UPDATE SET
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- DOMÍNIO: vehicles
INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
VALUES
  ('vehicles-segment-concessionaria', 'Concessionária', 'Concessionárias de veículos', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "vehicles"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('vehicles-segment-locadora', 'Locadora', 'Locadoras de veículos', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "vehicles"}'::jsonb, 
   NULL, NOW(), NOW())
ON CONFLICT (slug, country_code) DO UPDATE SET
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- DOMÍNIO: jobs
INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
VALUES
  ('jobs-segment-empresa', 'Empresa Contratante', 'Empresas que contratam', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "jobs"}'::jsonb, 
   NULL, NOW(), NOW()),
  ('jobs-segment-agencia', 'Agência de Recrutamento', 'Agências de recrutamento e seleção', NULL, 'global', true, 
   '{"domain": "marketplace", "taxonomy": "department", "level": 0, "category_type": "segment", "marketplace_domain": "jobs"}'::jsonb, 
   NULL, NOW(), NOW())
ON CONFLICT (slug, country_code) DO UPDATE SET
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- ============================================================
-- ETAPA 3: Garantir que offer_categories NÃO têm marketplace_domain
-- (são genéricas, não pertencem a um domínio específico)
-- ============================================================
UPDATE categories
SET metadata = metadata - 'marketplace_domain'
WHERE metadata->>'category_type' = 'offer_category'
  AND metadata->>'marketplace_domain' IS NOT NULL;

-- ============================================================
-- ETAPA 4: Log de validação
-- ============================================================
DO $$
DECLARE
  segments_count INTEGER;
  offer_categories_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO segments_count
  FROM categories
  WHERE metadata->>'category_type' = 'segment'
    AND metadata->>'domain' = 'marketplace';
  
  SELECT COUNT(*) INTO offer_categories_count
  FROM categories
  WHERE metadata->>'category_type' = 'offer_category'
    AND metadata->>'domain' = 'marketplace';
  
  RAISE NOTICE 'Segments criados: %', segments_count;
  RAISE NOTICE 'Offer categories: %', offer_categories_count;
END $$;

COMMIT;



