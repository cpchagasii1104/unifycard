-- ============================================================
-- UNIFICARD - MIGRATION 273
-- Marketplace Categories Seed
-- Criação de categorias iniciais do Marketplace (departments)
-- Todas com metadata.domain = 'marketplace' e metadata.taxonomy = 'department'
-- ============================================================

BEGIN;

-- ============================================================
-- CATEGORIAS RAIZ DO MARKETPLACE (Nível 0 - Departments)
-- ============================================================

-- Alimentação & Bebidas
INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, created_at, updated_at)
VALUES (
  'alimentacao-bebidas',
  'Alimentação & Bebidas',
  'Produtos alimentícios, bebidas, ingredientes e itens relacionados à alimentação',
  NULL,
  'global',
  true,
  '{"domain": "marketplace", "taxonomy": "department", "level": 0}'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Farmácia & Saúde (produtos)
INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, created_at, updated_at)
VALUES (
  'farmacia-saude',
  'Farmácia & Saúde',
  'Medicamentos, suplementos, produtos de higiene pessoal e itens de saúde',
  NULL,
  'global',
  true,
  '{"domain": "marketplace", "taxonomy": "department", "level": 0}'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Construção & Ferramentas
INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, created_at, updated_at)
VALUES (
  'construcao-ferramentas',
  'Construção & Ferramentas',
  'Materiais de construção, ferramentas, equipamentos e acessórios',
  NULL,
  'global',
  true,
  '{"domain": "marketplace", "taxonomy": "department", "level": 0}'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Casa & Decoração
INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, created_at, updated_at)
VALUES (
  'casa-decoracao',
  'Casa & Decoração',
  'Móveis, decoração, organização, utilidades domésticas e itens para o lar',
  NULL,
  'global',
  true,
  '{"domain": "marketplace", "taxonomy": "department", "level": 0}'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Moda & Acessórios
INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, created_at, updated_at)
VALUES (
  'moda-acessorios',
  'Moda & Acessórios',
  'Roupas, calçados, bolsas, acessórios e itens de moda',
  NULL,
  'global',
  true,
  '{"domain": "marketplace", "taxonomy": "department", "level": 0}'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Eletrônicos & Informática
INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, created_at, updated_at)
VALUES (
  'eletronicos-informatica',
  'Eletrônicos & Informática',
  'Eletrônicos, computadores, smartphones, acessórios e componentes',
  NULL,
  'global',
  true,
  '{"domain": "marketplace", "taxonomy": "department", "level": 0}'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Automotivo
INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, created_at, updated_at)
VALUES (
  'automotivo',
  'Automotivo',
  'Peças, acessórios, ferramentas e produtos para veículos',
  NULL,
  'global',
  true,
  '{"domain": "marketplace", "taxonomy": "department", "level": 0}'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Pet
INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, created_at, updated_at)
VALUES (
  'pet',
  'Pet',
  'Rações, brinquedos, acessórios e produtos para animais de estimação',
  NULL,
  'global',
  true,
  '{"domain": "marketplace", "taxonomy": "department", "level": 0}'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Papelaria & Escritório
INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, created_at, updated_at)
VALUES (
  'papelaria-escritorio',
  'Papelaria & Escritório',
  'Material escolar, de escritório, livros e itens relacionados',
  NULL,
  'global',
  true,
  '{"domain": "marketplace", "taxonomy": "department", "level": 0}'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Agro & Jardim
INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, created_at, updated_at)
VALUES (
  'agro-jardim',
  'Agro & Jardim',
  'Sementes, fertilizantes, ferramentas de jardim e produtos agrícolas',
  NULL,
  'global',
  true,
  '{"domain": "marketplace", "taxonomy": "department", "level": 0}'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

COMMIT;




