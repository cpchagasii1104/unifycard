-- ============================================================
-- UNIFICARD - MIGRATION 275
-- Marketplace Branches Seed
-- Criação de branches (products/services) para cada department
-- Todas com metadata.domain = 'marketplace' e metadata.taxonomy = 'branch'
-- ============================================================

BEGIN;

-- ============================================================
-- FUNÇÃO: Inserir branches para cada department
-- ============================================================
DO $$
DECLARE
  dept_record RECORD;
  products_branch_id UUID;
  services_branch_id UUID;
BEGIN
  -- Iterar sobre todos os departments do marketplace
  FOR dept_record IN 
    SELECT category_id, slug, name 
    FROM categories 
    WHERE metadata->>'domain' = 'marketplace' 
      AND metadata->>'taxonomy' = 'department'
      AND parent_id IS NULL
  LOOP
    -- ============================================================
    -- BRANCH: Products
    -- ============================================================
    INSERT INTO categories (
      slug, 
      name, 
      description, 
      parent_id, 
      scope, 
      is_active, 
      metadata, 
      country_code,
      created_at, 
      updated_at
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
    ON CONFLICT (slug, country_code) DO NOTHING
    RETURNING category_id INTO products_branch_id;

    -- ============================================================
    -- BRANCH: Services
    -- ============================================================
    INSERT INTO categories (
      slug, 
      name, 
      description, 
      parent_id, 
      scope, 
      is_active, 
      metadata, 
      country_code,
      created_at, 
      updated_at
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
    ON CONFLICT (slug, country_code) DO NOTHING
    RETURNING category_id INTO services_branch_id;

    RAISE NOTICE 'Branches criadas para department: % (products: %, services: %)', 
      dept_record.name, products_branch_id, services_branch_id;
  END LOOP;
END $$;

COMMIT;



