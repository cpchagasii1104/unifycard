-- ============================================================
-- UNIFICARD - MIGRATION 274
-- Marketplace Subcategories Seed (Nível 1)
-- Criação de subcategorias do Marketplace conectadas aos departments
-- Todas com metadata.domain = 'marketplace' e metadata.taxonomy = 'category'
-- ============================================================

BEGIN;

-- ============================================================
-- FUNÇÃO AUXILIAR: Buscar ID da categoria raiz pelo slug
-- ============================================================
DO $$
DECLARE
  alimentacao_id UUID;
  farmacia_id UUID;
  construcao_id UUID;
  casa_id UUID;
  moda_id UUID;
  eletronicos_id UUID;
  automotivo_id UUID;
  pet_id UUID;
  papelaria_id UUID;
  agro_id UUID;
BEGIN
  -- Buscar IDs das categorias raiz
  SELECT category_id INTO alimentacao_id FROM categories WHERE slug = 'alimentacao-bebidas' AND parent_id IS NULL LIMIT 1;
  SELECT category_id INTO farmacia_id FROM categories WHERE slug = 'farmacia-saude' AND parent_id IS NULL LIMIT 1;
  SELECT category_id INTO construcao_id FROM categories WHERE slug = 'construcao-ferramentas' AND parent_id IS NULL LIMIT 1;
  SELECT category_id INTO casa_id FROM categories WHERE slug = 'casa-decoracao' AND parent_id IS NULL LIMIT 1;
  SELECT category_id INTO moda_id FROM categories WHERE slug = 'moda-acessorios' AND parent_id IS NULL LIMIT 1;
  SELECT category_id INTO eletronicos_id FROM categories WHERE slug = 'eletronicos-informatica' AND parent_id IS NULL LIMIT 1;
  SELECT category_id INTO automotivo_id FROM categories WHERE slug = 'automotivo' AND parent_id IS NULL LIMIT 1;
  SELECT category_id INTO pet_id FROM categories WHERE slug = 'pet' AND parent_id IS NULL LIMIT 1;
  SELECT category_id INTO papelaria_id FROM categories WHERE slug = 'papelaria-escritorio' AND parent_id IS NULL LIMIT 1;
  SELECT category_id INTO agro_id FROM categories WHERE slug = 'agro-jardim' AND parent_id IS NULL LIMIT 1;

  -- ============================================================
  -- 1) ALIMENTAÇÃO & BEBIDAS - Subcategorias
  -- ============================================================
  IF alimentacao_id IS NOT NULL THEN
    INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
    VALUES
      ('acougue', 'Açougue', 'Carnes, aves, peixes e derivados', alimentacao_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('padaria', 'Padaria', 'Pães, bolos, doces e produtos de padaria', alimentacao_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('hortifruti', 'Hortifruti', 'Frutas, verduras e legumes frescos', alimentacao_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('bebidas', 'Bebidas', 'Refrigerantes, sucos, águas, cervejas e outras bebidas', alimentacao_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('mercearia', 'Mercearia', 'Produtos secos, enlatados, massas e conservas', alimentacao_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('congelados', 'Congelados', 'Produtos congelados e resfriados', alimentacao_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('limpeza', 'Limpeza', 'Produtos de limpeza doméstica', alimentacao_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('higiene', 'Higiene', 'Produtos de higiene pessoal e doméstica', alimentacao_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW())
    ON CONFLICT (slug, country_code) DO NOTHING;
  END IF;

  -- ============================================================
  -- 2) FARMÁCIA & SAÚDE - Subcategorias
  -- ============================================================
  IF farmacia_id IS NOT NULL THEN
    INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
    VALUES
      ('medicamentos', 'Medicamentos', 'Medicamentos com e sem prescrição', farmacia_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('higiene-pessoal', 'Higiene Pessoal', 'Produtos de higiene e cuidado pessoal', farmacia_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('perfumaria', 'Perfumaria', 'Perfumes, desodorantes e cosméticos', farmacia_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('suplementos', 'Suplementos', 'Suplementos alimentares e vitamínicos', farmacia_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('equipamentos-medicos', 'Equipamentos Médicos', 'Equipamentos e aparelhos médicos', farmacia_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW())
    ON CONFLICT (slug, country_code) DO NOTHING;
  END IF;

  -- ============================================================
  -- 3) CONSTRUÇÃO & FERRAMENTAS - Subcategorias
  -- ============================================================
  IF construcao_id IS NOT NULL THEN
    INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
    VALUES
      ('eletrica', 'Elétrica', 'Materiais e equipamentos elétricos', construcao_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('hidraulica', 'Hidráulica', 'Materiais e equipamentos hidráulicos', construcao_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('ferramentas', 'Ferramentas', 'Ferramentas manuais e elétricas', construcao_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('materiais-basicos', 'Materiais Básicos', 'Cimento, tijolos, areia e materiais básicos de construção', construcao_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('acabamentos', 'Acabamentos', 'Pisos, azulejos, portas, janelas e acabamentos', construcao_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('tintas', 'Tintas', 'Tintas, vernizes e produtos relacionados', construcao_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW())
    ON CONFLICT (slug, country_code) DO NOTHING;
  END IF;

  -- ============================================================
  -- 4) CASA & DECORAÇÃO - Subcategorias
  -- ============================================================
  IF casa_id IS NOT NULL THEN
    INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
    VALUES
      ('moveis', 'Móveis', 'Móveis para casa e escritório', casa_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('eletrodomesticos', 'Eletrodomésticos', 'Eletrodomésticos e aparelhos para o lar', casa_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('decoracao', 'Decoração', 'Itens de decoração e ornamentação', casa_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('utilidades-domesticas', 'Utilidades Domésticas', 'Utensílios e produtos para uso doméstico', casa_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('cama-mesa-banho', 'Cama, Mesa & Banho', 'Roupas de cama, mesa e banho', casa_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW())
    ON CONFLICT (slug, country_code) DO NOTHING;
  END IF;

  -- ============================================================
  -- 5) MODA & ACESSÓRIOS - Subcategorias
  -- ============================================================
  IF moda_id IS NOT NULL THEN
    INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
    VALUES
      ('roupas-masculinas', 'Roupas Masculinas', 'Roupas e vestuário masculino', moda_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('roupas-femininas', 'Roupas Femininas', 'Roupas e vestuário feminino', moda_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('roupas-infantis', 'Roupas Infantis', 'Roupas e vestuário infantil', moda_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('calcados', 'Calçados', 'Calçados para todos os gêneros e idades', moda_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('acessorios', 'Acessórios', 'Bolsas, relógios, óculos e acessórios de moda', moda_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW())
    ON CONFLICT (slug, country_code) DO NOTHING;
  END IF;

  -- ============================================================
  -- 6) ELETRÔNICOS & INFORMÁTICA - Subcategorias
  -- ============================================================
  IF eletronicos_id IS NOT NULL THEN
    INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
    VALUES
      ('smartphones', 'Smartphones', 'Smartphones e celulares', eletronicos_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('computadores', 'Computadores', 'Notebooks, desktops e tablets', eletronicos_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('perifericos', 'Periféricos', 'Teclados, mouses, monitores e periféricos', eletronicos_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('audio-video', 'Áudio & Vídeo', 'Aparelhos de áudio, vídeo e home theater', eletronicos_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('acessorios-eletronicos', 'Acessórios Eletrônicos', 'Cabos, carregadores e acessórios eletrônicos', eletronicos_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW())
    ON CONFLICT (slug, country_code) DO NOTHING;
  END IF;

  -- ============================================================
  -- 7) AUTOMOTIVO - Subcategorias
  -- ============================================================
  IF automotivo_id IS NOT NULL THEN
    INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
    VALUES
      ('pecas', 'Peças', 'Peças automotivas e reposição', automotivo_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('acessorios-automotivos', 'Acessórios', 'Acessórios e equipamentos para veículos', automotivo_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('lubrificantes', 'Lubrificantes', 'Óleos, graxas e lubrificantes', automotivo_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('ferramentas-automotivas', 'Ferramentas Automotivas', 'Ferramentas específicas para manutenção automotiva', automotivo_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW())
    ON CONFLICT (slug, country_code) DO NOTHING;
  END IF;

  -- ============================================================
  -- 8) PET - Subcategorias
  -- ============================================================
  IF pet_id IS NOT NULL THEN
    INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
    VALUES
      ('racoes', 'Rações', 'Rações e alimentos para animais', pet_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('medicamentos-veterinarios', 'Medicamentos Veterinários', 'Medicamentos e produtos veterinários', pet_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('acessorios-pet', 'Acessórios Pet', 'Brinquedos, coleiras, casinhas e acessórios', pet_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('higiene-pet', 'Higiene Pet', 'Produtos de higiene e limpeza para pets', pet_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW())
    ON CONFLICT (slug, country_code) DO NOTHING;
  END IF;

  -- ============================================================
  -- 9) PAPELARIA & ESCRITÓRIO - Subcategorias
  -- ============================================================
  IF papelaria_id IS NOT NULL THEN
    INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
    VALUES
      ('material-escolar', 'Material Escolar', 'Materiais e produtos escolares', papelaria_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('material-escritorio', 'Material de Escritório', 'Materiais e produtos para escritório', papelaria_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('informatica-basica', 'Informática Básica', 'Produtos básicos de informática para escritório', papelaria_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW())
    ON CONFLICT (slug, country_code) DO NOTHING;
  END IF;

  -- ============================================================
  -- 10) AGRO & JARDIM - Subcategorias
  -- ============================================================
  IF agro_id IS NOT NULL THEN
    INSERT INTO categories (slug, name, description, parent_id, scope, is_active, metadata, country_code, created_at, updated_at)
    VALUES
      ('jardinagem', 'Jardinagem', 'Ferramentas e produtos para jardinagem', agro_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('ferramentas-agricolas', 'Ferramentas Agrícolas', 'Ferramentas e equipamentos agrícolas', agro_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('insumos', 'Insumos', 'Fertilizantes, defensivos e insumos agrícolas', agro_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW()),
      ('sementes', 'Sementes', 'Sementes e mudas', agro_id, 'global', true, '{"domain": "marketplace", "taxonomy": "category", "level": 1}'::jsonb, NULL, NOW(), NOW())
    ON CONFLICT (slug, country_code) DO NOTHING;
  END IF;

END $$;

COMMIT;

