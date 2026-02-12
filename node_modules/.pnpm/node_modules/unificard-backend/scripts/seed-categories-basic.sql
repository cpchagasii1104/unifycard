-- ============================================================
-- SEED BÁSICO: Criar categorias para /categories/tree
-- ============================================================

-- Verificar se já existem categorias
DO $$
DECLARE
  existing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO existing_count
  FROM categories
  WHERE status = 'active' OR status IS NULL;
  
  IF existing_count > 0 THEN
    RAISE NOTICE 'Já existem % categorias visíveis. Pulando seed.', existing_count;
    RETURN;
  END IF;
END $$;

-- Criar categorias raiz básicas
INSERT INTO categories (category_id, parent_id, name, slug, description, level, path, status, keywords, created_at, updated_at)
VALUES
  -- Raiz: Profissional
  (
    gen_random_uuid(),
    NULL,
    'Profissional',
    'profissional',
    'Categorias relacionadas à vida profissional',
    0,
    ARRAY['profissional'],
    'active',
    ARRAY[]::text[],
    now(),
    now()
  ),
  -- Raiz: Pessoal
  (
    gen_random_uuid(),
    NULL,
    'Pessoal',
    'pessoal',
    'Categorias relacionadas à vida pessoal',
    0,
    ARRAY['pessoal'],
    'active',
    ARRAY[]::text[],
    now(),
    now()
  ),
  -- Raiz: Físico
  (
    gen_random_uuid(),
    NULL,
    'Físico',
    'fisico',
    'Categorias relacionadas ao bem-estar físico',
    0,
    ARRAY['fisico'],
    'active',
    ARRAY[]::text[],
    now(),
    now()
  ),
  -- Raiz: Aprendizado
  (
    gen_random_uuid(),
    NULL,
    'Aprendizado',
    'aprendizado',
    'Categorias relacionadas ao aprendizado e educação',
    0,
    ARRAY['aprendizado'],
    'active',
    ARRAY[]::text[],
    now(),
    now()
  )
ON CONFLICT DO NOTHING;

-- Criar algumas categorias filhas (exemplo)
DO $$
DECLARE
  profissional_id UUID;
  pessoal_id UUID;
  fisico_id UUID;
  aprendizado_id UUID;
BEGIN
  -- Buscar IDs das raízes
  SELECT category_id INTO profissional_id FROM categories WHERE slug = 'profissional' AND parent_id IS NULL LIMIT 1;
  SELECT category_id INTO pessoal_id FROM categories WHERE slug = 'pessoal' AND parent_id IS NULL LIMIT 1;
  SELECT category_id INTO fisico_id FROM categories WHERE slug = 'fisico' AND parent_id IS NULL LIMIT 1;
  SELECT category_id INTO aprendizado_id FROM categories WHERE slug = 'aprendizado' AND parent_id IS NULL LIMIT 1;
  
  -- Filhos de Profissional
  IF profissional_id IS NOT NULL THEN
    INSERT INTO categories (category_id, parent_id, name, slug, description, level, path, status, keywords, created_at, updated_at)
    VALUES
      (gen_random_uuid(), profissional_id, 'Tecnologia da Informação', 'tecnologia-informacao', 'TI e desenvolvimento', 1, ARRAY['profissional', 'tecnologia-informacao'], 'active', ARRAY[]::text[], now(), now()),
      (gen_random_uuid(), profissional_id, 'Medicina', 'medicina', 'Área médica', 1, ARRAY['profissional', 'medicina'], 'active', ARRAY[]::text[], now(), now()),
      (gen_random_uuid(), profissional_id, 'Advocacia', 'advocacia', 'Direito e advocacia', 1, ARRAY['profissional', 'advocacia'], 'active', ARRAY[]::text[], now(), now())
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Filhos de Pessoal
  IF pessoal_id IS NOT NULL THEN
    INSERT INTO categories (category_id, parent_id, name, slug, description, level, path, status, keywords, created_at, updated_at)
    VALUES
      (gen_random_uuid(), pessoal_id, 'Família', 'familia', 'Vida familiar', 1, ARRAY['pessoal', 'familia'], 'active', ARRAY[]::text[], now(), now()),
      (gen_random_uuid(), pessoal_id, 'Hobbies', 'hobbies', 'Passatempos e hobbies', 1, ARRAY['pessoal', 'hobbies'], 'active', ARRAY[]::text[], now(), now())
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Filhos de Físico
  IF fisico_id IS NOT NULL THEN
    INSERT INTO categories (category_id, parent_id, name, slug, description, level, path, status, keywords, created_at, updated_at)
    VALUES
      (gen_random_uuid(), fisico_id, 'Esportes', 'esportes', 'Atividades esportivas', 1, ARRAY['fisico', 'esportes'], 'active', ARRAY[]::text[], now(), now()),
      (gen_random_uuid(), fisico_id, 'Saúde', 'saude', 'Saúde e bem-estar', 1, ARRAY['fisico', 'saude'], 'active', ARRAY[]::text[], now(), now())
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Filhos de Aprendizado
  IF aprendizado_id IS NOT NULL THEN
    INSERT INTO categories (category_id, parent_id, name, slug, description, level, path, status, keywords, created_at, updated_at)
    VALUES
      (gen_random_uuid(), aprendizado_id, 'Educação Formal', 'educacao-formal', 'Cursos e educação formal', 1, ARRAY['aprendizado', 'educacao-formal'], 'active', ARRAY[]::text[], now(), now()),
      (gen_random_uuid(), aprendizado_id, 'Habilidades', 'habilidades', 'Desenvolvimento de habilidades', 1, ARRAY['aprendizado', 'habilidades'], 'active', ARRAY[]::text[], now(), now())
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Verificar resultado
SELECT 
  'Categorias criadas' as metric,
  COUNT(*)::text as value
FROM categories
WHERE status = 'active'
UNION ALL
SELECT 
  'Categorias raiz',
  COUNT(*)::text
FROM categories
WHERE parent_id IS NULL AND (status = 'active' OR status IS NULL);

-- Listar categorias criadas
SELECT 
  category_id,
  name,
  slug,
  status,
  parent_id,
  level
FROM categories
WHERE status = 'active' OR status IS NULL
ORDER BY level ASC, name ASC;













