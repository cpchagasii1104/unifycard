-- ============================================================
-- UNIFICARD - MIGRATION 276
-- Marketplace Taxonomy Fix - Produtos e Serviços
-- Garante branches obrigatórias e move categorias existentes
-- ============================================================

BEGIN;

-- ============================================================
-- FUNÇÃO: Criar branches e reorganizar taxonomia
-- ============================================================
DO $$
DECLARE
  dept_record RECORD;
  products_branch_id UUID;
  services_branch_id UUID;
  existing_category RECORD;
  new_category_id UUID;
BEGIN
  -- Iterar sobre todos os departments do marketplace
  FOR dept_record IN 
    SELECT category_id, slug, name 
    FROM categories 
    WHERE metadata->>'domain' = 'marketplace' 
      AND metadata->>'taxonomy' = 'department'
      AND parent_id IS NULL
    ORDER BY name
  LOOP
    -- ============================================================
    -- 1. CRIAR/VERIFICAR BRANCH: Products
    -- ============================================================
    SELECT category_id INTO products_branch_id
    FROM categories
    WHERE slug = dept_record.slug || '-products'
      AND parent_id = dept_record.category_id
      AND metadata->>'taxonomy' = 'branch'
    LIMIT 1;

    IF products_branch_id IS NULL THEN
      INSERT INTO categories (
        slug, name, description, parent_id, scope, is_active, 
        metadata, country_code, created_at, updated_at
      )
      VALUES (
        dept_record.slug || '-products',
        'Produtos',
        'Produtos físicos e itens tangíveis',
        dept_record.category_id,
        'global',
        true,
        jsonb_build_object(
          'domain', 'marketplace',
          'taxonomy', 'branch',
          'level', 1,
          'branch_type', 'products'
        ),
        NULL,
        NOW(),
        NOW()
      )
      ON CONFLICT (slug, country_code) DO UPDATE
      SET metadata = jsonb_build_object(
        'domain', 'marketplace',
        'taxonomy', 'branch',
        'level', 1,
        'branch_type', 'products'
      ),
      updated_at = NOW()
      RETURNING category_id INTO products_branch_id;
    END IF;

    -- ============================================================
    -- 2. CRIAR/VERIFICAR BRANCH: Services
    -- ============================================================
    SELECT category_id INTO services_branch_id
    FROM categories
    WHERE slug = dept_record.slug || '-services'
      AND parent_id = dept_record.category_id
      AND metadata->>'taxonomy' = 'branch'
    LIMIT 1;

    IF services_branch_id IS NULL THEN
      INSERT INTO categories (
        slug, name, description, parent_id, scope, is_active, 
        metadata, country_code, created_at, updated_at
      )
      VALUES (
        dept_record.slug || '-services',
        'Serviços',
        'Serviços profissionais e prestações',
        dept_record.category_id,
        'global',
        true,
        jsonb_build_object(
          'domain', 'marketplace',
          'taxonomy', 'branch',
          'level', 1,
          'branch_type', 'services'
        ),
        NULL,
        NOW(),
        NOW()
      )
      ON CONFLICT (slug, country_code) DO UPDATE
      SET metadata = jsonb_build_object(
        'domain', 'marketplace',
        'taxonomy', 'branch',
        'level', 1,
        'branch_type', 'services'
      ),
      updated_at = NOW()
      RETURNING category_id INTO services_branch_id;
    END IF;

    -- ============================================================
    -- 3. MOVER CATEGORIAS EXISTENTES PARA BRANCH 'products'
    -- ============================================================
    -- Categorias que estão diretamente sob o department (sem branch)
    FOR existing_category IN
      SELECT category_id, slug, name
      FROM categories
      WHERE parent_id = dept_record.category_id
        AND metadata->>'domain' = 'marketplace'
        AND (metadata->>'taxonomy' IS NULL OR (metadata->>'taxonomy' != 'branch' AND metadata->>'taxonomy' != 'department'))
    LOOP
      -- Mover para branch products
      UPDATE categories
      SET parent_id = products_branch_id,
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'taxonomy', 'category',
            'level', 2
          ),
          updated_at = NOW()
      WHERE category_id = existing_category.category_id;
      
      RAISE NOTICE 'Categoria movida para products: % (department: %)', 
        existing_category.name, dept_record.name;
    END LOOP;

    -- ============================================================
    -- 4. CRIAR CATEGORIAS DE SERVIÇOS INICIAIS
    -- ============================================================
    
    -- Alimentação & Bebidas - Serviços
    IF dept_record.slug = 'alimentacao-bebidas' THEN
      INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
      VALUES
        ('alimentacao-bebidas-services-restaurantes', 'Restaurantes', 'Restaurantes e casas de comida', services_branch_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 2, "type": "service"}'::jsonb, NULL, NOW(), NOW()),
        ('alimentacao-bebidas-services-pizzarias', 'Pizzarias', 'Pizzarias e casas de pizza', services_branch_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 2, "type": "service"}'::jsonb, NULL, NOW(), NOW()),
        ('alimentacao-bebidas-services-lanchonetes', 'Lanchonetes', 'Lanchonetes e fast food', services_branch_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 2, "type": "service"}'::jsonb, NULL, NOW(), NOW()),
        ('alimentacao-bebidas-services-delivery', 'Delivery', 'Serviços de entrega de comida', services_branch_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 2, "type": "service"}'::jsonb, NULL, NOW(), NOW()),
        ('alimentacao-bebidas-services-buffet', 'Buffet', 'Buffets e eventos gastronômicos', services_branch_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 2, "type": "service"}'::jsonb, NULL, NOW(), NOW())
      ON CONFLICT (slug, country_code) DO NOTHING;
    END IF;

    -- Automotivo - Serviços
    IF dept_record.slug = 'automotivo' THEN
      INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
      VALUES
        ('automotivo-services-oficinas', 'Oficinas', 'Oficinas mecânicas e serviços automotivos', services_branch_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 2, "type": "service"}'::jsonb, NULL, NOW(), NOW()),
        ('automotivo-services-lava-jato', 'Lava Jato', 'Lava jato e serviços de limpeza automotiva', services_branch_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 2, "type": "service"}'::jsonb, NULL, NOW(), NOW()),
        ('automotivo-services-guincho', 'Guincho', 'Serviços de guincho e reboque', services_branch_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 2, "type": "service"}'::jsonb, NULL, NOW(), NOW())
      ON CONFLICT (slug, country_code) DO NOTHING;
    END IF;

    -- Casa & Decoração - Serviços
    IF dept_record.slug = 'casa-decoracao' THEN
      INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
      VALUES
        ('casa-decoracao-services-montagem', 'Montagem', 'Montagem de móveis e equipamentos', services_branch_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 2, "type": "service"}'::jsonb, NULL, NOW(), NOW()),
        ('casa-decoracao-services-instalacao', 'Instalação', 'Instalação de equipamentos e sistemas', services_branch_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 2, "type": "service"}'::jsonb, NULL, NOW(), NOW()),
        ('casa-decoracao-services-design-interiores', 'Design de Interiores', 'Serviços de design e decoração', services_branch_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 2, "type": "service"}'::jsonb, NULL, NOW(), NOW())
      ON CONFLICT (slug, country_code) DO NOTHING;
    END IF;

    -- Eletrônicos & Informática - Serviços
    IF dept_record.slug = 'eletronicos-informatica' THEN
      INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
      VALUES
        ('eletronicos-informatica-services-assistencia-tecnica', 'Assistência Técnica', 'Assistência técnica para eletrônicos', services_branch_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 2, "type": "service"}'::jsonb, NULL, NOW(), NOW()),
        ('eletronicos-informatica-services-manutencao', 'Manutenção', 'Manutenção de equipamentos eletrônicos', services_branch_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 2, "type": "service"}'::jsonb, NULL, NOW(), NOW()),
        ('eletronicos-informatica-services-suporte-tecnico', 'Suporte Técnico', 'Suporte técnico e consultoria em TI', services_branch_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 2, "type": "service"}'::jsonb, NULL, NOW(), NOW())
      ON CONFLICT (slug, country_code) DO NOTHING;
    END IF;

    RAISE NOTICE 'Branches criadas/atualizadas para department: % (products: %, services: %)', 
      dept_record.name, products_branch_id, services_branch_id;
  END LOOP;
END $$;

COMMIT;

