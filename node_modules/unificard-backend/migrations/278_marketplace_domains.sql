-- ============================================================
-- UNIFICARD - MIGRATION 278
-- Marketplace Domains - Governança de domínios
-- Adiciona metadata.marketplace_domain e cria conteúdo mínimo
-- ============================================================

BEGIN;

-- ============================================================
-- 1. SETAR marketplace_domain='market' EM TODAS AS CATEGORIAS EXISTENTES
-- ============================================================
UPDATE categories
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('marketplace_domain', 'market')
WHERE metadata->>'domain' = 'marketplace'
  AND (metadata->>'marketplace_domain' IS NULL OR metadata->>'marketplace_domain' = '');

-- ============================================================
-- 2. CRIAR DEPARTMENTS BASE PARA SERVICES (se não existirem)
-- ============================================================
DO $$
DECLARE
  dept_record RECORD;
  services_branch_id UUID;
BEGIN
  -- Pet - Services
  SELECT category_id INTO dept_record
  FROM categories
  WHERE slug = 'pet'
    AND metadata->>'domain' = 'marketplace'
    AND metadata->>'taxonomy' = 'department'
  LIMIT 1;

  IF dept_record.category_id IS NOT NULL THEN
    -- Buscar ou criar branch services
    SELECT category_id INTO services_branch_id
    FROM categories
    WHERE slug = 'pet-services'
      AND parent_id = dept_record.category_id
      AND metadata->>'taxonomy' = 'branch'
    LIMIT 1;

    IF services_branch_id IS NULL THEN
      INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
      VALUES (
        'pet-services',
        'Serviços',
        'Serviços para pets',
        dept_record.category_id,
        'global',
        true,
        '{"domain": "marketplace", "marketplace_domain": "services", "taxonomy": "branch", "level": 1, "branch_type": "services"}'::jsonb,
        NULL,
        NOW(),
        NOW()
      )
      RETURNING category_id INTO services_branch_id;
    ELSE
      -- Atualizar marketplace_domain se já existir
      UPDATE categories
      SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('marketplace_domain', 'services')
      WHERE category_id = services_branch_id;
    END IF;

    -- Criar categorias de serviços para Pet
    INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
    VALUES
      ('pet-services-veterinario', 'Veterinário', 'Serviços veterinários', services_branch_id, 'global', true, '{"domain": "marketplace", "marketplace_domain": "services", "taxonomy": "category", "level": 2, "type": "service"}'::jsonb, NULL, NOW(), NOW()),
      ('pet-services-banho-tosa', 'Banho & Tosa', 'Serviços de banho e tosa', services_branch_id, 'global', true, '{"domain": "marketplace", "marketplace_domain": "services", "taxonomy": "category", "level": 2, "type": "service"}'::jsonb, NULL, NOW(), NOW()),
      ('pet-services-adestramento', 'Adestramento', 'Serviços de adestramento', services_branch_id, 'global', true, '{"domain": "marketplace", "marketplace_domain": "services", "taxonomy": "category", "level": 2, "type": "service"}'::jsonb, NULL, NOW(), NOW())
    ON CONFLICT (slug, country_code) DO UPDATE
    SET metadata = COALESCE(categories.metadata, '{}'::jsonb) || jsonb_build_object('marketplace_domain', 'services');
  END IF;

  -- Moda - Services
  SELECT category_id INTO dept_record
  FROM categories
  WHERE slug = 'moda-acessorios'
    AND metadata->>'domain' = 'marketplace'
    AND metadata->>'taxonomy' = 'department'
  LIMIT 1;

  IF dept_record.category_id IS NOT NULL THEN
    SELECT category_id INTO services_branch_id
    FROM categories
    WHERE slug = 'moda-acessorios-services'
      AND parent_id = dept_record.category_id
      AND metadata->>'taxonomy' = 'branch'
    LIMIT 1;

    IF services_branch_id IS NULL THEN
      INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
      VALUES (
        'moda-acessorios-services',
        'Serviços',
        'Serviços de moda',
        dept_record.category_id,
        'global',
        true,
        '{"domain": "marketplace", "marketplace_domain": "services", "taxonomy": "branch", "level": 1, "branch_type": "services"}'::jsonb,
        NULL,
        NOW(),
        NOW()
      )
      RETURNING category_id INTO services_branch_id;
    ELSE
      UPDATE categories
      SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('marketplace_domain', 'services')
      WHERE category_id = services_branch_id;
    END IF;

    -- Criar categorias de serviços para Moda
    INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
    VALUES
      ('moda-acessorios-services-costura', 'Costura', 'Serviços de costura', services_branch_id, 'global', true, '{"domain": "marketplace", "marketplace_domain": "services", "taxonomy": "category", "level": 2, "type": "service"}'::jsonb, NULL, NOW(), NOW()),
      ('moda-acessorios-services-ajustes', 'Ajustes', 'Serviços de ajustes de roupas', services_branch_id, 'global', true, '{"domain": "marketplace", "marketplace_domain": "services", "taxonomy": "category", "level": 2, "type": "service"}'::jsonb, NULL, NOW(), NOW()),
      ('moda-acessorios-services-alfaiataria', 'Alfaiataria', 'Serviços de alfaiataria', services_branch_id, 'global', true, '{"domain": "marketplace", "marketplace_domain": "services", "taxonomy": "category", "level": 2, "type": "service"}'::jsonb, NULL, NOW(), NOW())
    ON CONFLICT (slug, country_code) DO UPDATE
    SET metadata = COALESCE(categories.metadata, '{}'::jsonb) || jsonb_build_object('marketplace_domain', 'services');
  END IF;

  -- Alimentação & Bebidas - Services (garantir que já existentes tenham marketplace_domain)
  UPDATE categories
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('marketplace_domain', 'services')
  WHERE slug LIKE 'alimentacao-bebidas-services%'
    AND metadata->>'domain' = 'marketplace'
    AND (metadata->>'marketplace_domain' IS NULL OR metadata->>'marketplace_domain' = '');
END $$;

COMMIT;



