-- ============================================================
-- UNIFICARD - MIGRATION 277
-- Marketplace Content Seed - Conteúdo mínimo obrigatório
-- Garante estrutura completa para Alimentação & Bebidas e Imóveis
-- ============================================================

BEGIN;

DO $$
DECLARE
  dept_record RECORD;
  products_branch_id UUID;
  services_branch_id UUID;
  events_branch_id UUID;
  rentals_short_branch_id UUID;
  rentals_long_branch_id UUID;
BEGIN
  -- ============================================================
  -- ALIMENTAÇÃO & BEBIDAS
  -- ============================================================
  SELECT category_id INTO dept_record
  FROM categories
  WHERE slug = 'alimentacao-bebidas'
    AND metadata->>'domain' = 'marketplace'
    AND metadata->>'taxonomy' = 'department'
  LIMIT 1;

  IF dept_record.category_id IS NOT NULL THEN
    -- Buscar ou criar branches
    SELECT category_id INTO products_branch_id
    FROM categories
    WHERE slug = 'alimentacao-bebidas-products'
      AND parent_id = dept_record.category_id
    LIMIT 1;

    SELECT category_id INTO services_branch_id
    FROM categories
    WHERE slug = 'alimentacao-bebidas-services'
      AND parent_id = dept_record.category_id
    LIMIT 1;

    SELECT category_id INTO events_branch_id
    FROM categories
    WHERE slug = 'alimentacao-bebidas-events'
      AND parent_id = dept_record.category_id
    LIMIT 1;

    -- Criar branch Products se não existir
    IF products_branch_id IS NULL THEN
      INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
      VALUES (
        'alimentacao-bebidas-products',
        'Produtos',
        'Produtos alimentícios e bebidas',
        dept_record.category_id,
        'global',
        true,
        '{"domain": "marketplace", "taxonomy": "branch", "level": 1, "branch_type": "products"}'::jsonb,
        NULL,
        NOW(),
        NOW()
      )
      RETURNING category_id INTO products_branch_id;
    END IF;

    -- Criar branch Services se não existir
    IF services_branch_id IS NULL THEN
      INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
      VALUES (
        'alimentacao-bebidas-services',
        'Serviços',
        'Serviços gastronômicos',
        dept_record.category_id,
        'global',
        true,
        '{"domain": "marketplace", "taxonomy": "branch", "level": 1, "branch_type": "services"}'::jsonb,
        NULL,
        NOW(),
        NOW()
      )
      RETURNING category_id INTO services_branch_id;
    END IF;

    -- Criar branch Events se não existir
    IF events_branch_id IS NULL THEN
      INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
      VALUES (
        'alimentacao-bebidas-events',
        'Eventos',
        'Eventos gastronômicos e culturais',
        dept_record.category_id,
        'global',
        true,
        '{"domain": "marketplace", "taxonomy": "branch", "level": 1, "branch_type": "events"}'::jsonb,
        NULL,
        NOW(),
        NOW()
      )
      RETURNING category_id INTO events_branch_id;
    END IF;

    -- Products: mercado, açougue, padaria, bebidas
    INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
    VALUES
      ('alimentacao-bebidas-products-mercado', 'Mercado', 'Supermercados e mercados', products_branch_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 2, "type": "product"}'::jsonb, NULL, NOW(), NOW()),
      ('alimentacao-bebidas-products-acougue', 'Açougue', 'Carnes e produtos de açougue', products_branch_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 2, "type": "product"}'::jsonb, NULL, NOW(), NOW()),
      ('alimentacao-bebidas-products-padaria', 'Padaria', 'Pães, bolos e produtos de padaria', products_branch_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 2, "type": "product"}'::jsonb, NULL, NOW(), NOW()),
      ('alimentacao-bebidas-products-bebidas', 'Bebidas', 'Bebidas alcoólicas e não alcoólicas', products_branch_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 2, "type": "product"}'::jsonb, NULL, NOW(), NOW())
    ON CONFLICT (slug, country_code) DO NOTHING;

    -- Services: restaurantes, lanchonetes, pizzarias, bares
    INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
    VALUES
      ('alimentacao-bebidas-services-restaurantes', 'Restaurantes', 'Restaurantes e casas de comida', services_branch_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 2, "type": "service"}'::jsonb, NULL, NOW(), NOW()),
      ('alimentacao-bebidas-services-lanchonetes', 'Lanchonetes', 'Lanchonetes e fast food', services_branch_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 2, "type": "service"}'::jsonb, NULL, NOW(), NOW()),
      ('alimentacao-bebidas-services-pizzarias', 'Pizzarias', 'Pizzarias e casas de pizza', services_branch_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 2, "type": "service"}'::jsonb, NULL, NOW(), NOW()),
      ('alimentacao-bebidas-services-bares', 'Bares', 'Bares e casas noturnas', services_branch_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 2, "type": "service"}'::jsonb, NULL, NOW(), NOW())
    ON CONFLICT (slug, country_code) DO NOTHING;

    -- Events: festivais gastronômicos, eventos, feiras
    INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
    VALUES
      ('alimentacao-bebidas-events-festivais', 'Festivais Gastronômicos', 'Festivais e eventos gastronômicos', events_branch_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 2, "type": "event"}'::jsonb, NULL, NOW(), NOW()),
      ('alimentacao-bebidas-events-eventos', 'Eventos', 'Eventos e celebrações gastronômicas', events_branch_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 2, "type": "event"}'::jsonb, NULL, NOW(), NOW()),
      ('alimentacao-bebidas-events-feiras', 'Feiras', 'Feiras gastronômicas e de produtos', events_branch_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 2, "type": "event"}'::jsonb, NULL, NOW(), NOW())
    ON CONFLICT (slug, country_code) DO NOTHING;
  END IF;

  -- ============================================================
  -- IMÓVEIS
  -- ============================================================
  SELECT category_id INTO dept_record
  FROM categories
  WHERE slug = 'imoveis'
    AND metadata->>'domain' = 'marketplace'
    AND metadata->>'taxonomy' = 'department'
  LIMIT 1;

  IF dept_record.category_id IS NOT NULL THEN
    -- Buscar ou criar branches
    SELECT category_id INTO rentals_short_branch_id
    FROM categories
    WHERE slug = 'imoveis-rentals-short'
      AND parent_id = dept_record.category_id
    LIMIT 1;

    SELECT category_id INTO rentals_long_branch_id
    FROM categories
    WHERE slug = 'imoveis-rentals-long'
      AND parent_id = dept_record.category_id
    LIMIT 1;

    SELECT category_id INTO services_branch_id
    FROM categories
    WHERE slug = 'imoveis-services'
      AND parent_id = dept_record.category_id
    LIMIT 1;

    -- Criar branch Rentals Short se não existir
    IF rentals_short_branch_id IS NULL THEN
      INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
      VALUES (
        'imoveis-rentals-short',
        'Estadias Curtas',
        'Aluguel de curta duração (Airbnb, temporada)',
        dept_record.category_id,
        'global',
        true,
        '{"domain": "marketplace", "taxonomy": "branch", "level": 1, "branch_type": "rentals_short"}'::jsonb,
        NULL,
        NOW(),
        NOW()
      )
      RETURNING category_id INTO rentals_short_branch_id;
    END IF;

    -- Criar branch Rentals Long se não existir
    IF rentals_long_branch_id IS NULL THEN
      INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
      VALUES (
        'imoveis-rentals-long',
        'Estadias Longas',
        'Aluguel de longa duração (imobiliária)',
        dept_record.category_id,
        'global',
        true,
        '{"domain": "marketplace", "taxonomy": "branch", "level": 1, "branch_type": "rentals_long"}'::jsonb,
        NULL,
        NOW(),
        NOW()
      )
      RETURNING category_id INTO rentals_long_branch_id;
    END IF;

    -- Criar branch Services se não existir
    IF services_branch_id IS NULL THEN
      INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
      VALUES (
        'imoveis-services',
        'Serviços',
        'Serviços imobiliários e corretagem',
        dept_record.category_id,
        'global',
        true,
        '{"domain": "marketplace", "taxonomy": "branch", "level": 1, "branch_type": "services"}'::jsonb,
        NULL,
        NOW(),
        NOW()
      )
      RETURNING category_id INTO services_branch_id;
    END IF;

    -- Services: corretagem
    INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
    VALUES
      ('imoveis-services-corretagem', 'Corretagem', 'Serviços de corretagem imobiliária', services_branch_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 2, "type": "service"}'::jsonb, NULL, NOW(), NOW())
    ON CONFLICT (slug, country_code) DO NOTHING;
  END IF;

END $$;

COMMIT;



