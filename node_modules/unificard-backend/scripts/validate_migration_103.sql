-- ============================================================
-- SCRIPT DE VALIDAÇÃO PÓS-MIGRATION 103
-- Arquivo: validate_migration_103.sql
-- Uso: Execute após executar migration 103
-- ============================================================

\echo '========================================'
\echo 'VALIDAÇÃO PÓS-MIGRATION 103'
\echo '========================================'
\echo ''

-- ============================================================
-- 1. VALIDAÇÃO DE CONSTRAINTS
-- ============================================================

\echo '1. VALIDAÇÃO DE CONSTRAINTS'
\echo '----------------------------------------'

-- 1.1 Constraint CNPJ (deve retornar 1)
\echo '1.1 Constraint CNPJ (esperado: 1)'
SELECT COUNT(*) as cnpj_constraints
FROM pg_constraint 
WHERE conrelid = 'companies'::regclass 
  AND conname = 'companies_cnpj_format';

-- 1.2 Definição da constraint CNPJ
\echo '1.2 Definição da constraint CNPJ (esperado: CHECK (cnpj ~ ''^[0-9]{14}$''))'
SELECT pg_get_constraintdef(oid) as cnpj_constraint_def
FROM pg_constraint 
WHERE conrelid = 'companies'::regclass 
  AND conname = 'companies_cnpj_format';

-- 1.3 Constraint status (deve retornar 1)
\echo '1.3 Constraint status (esperado: 1)'
SELECT COUNT(*) as status_constraints
FROM pg_constraint 
WHERE conrelid = 'categories'::regclass 
  AND conname = 'categories_status_check';

-- 1.4 Definição da constraint status
\echo '1.4 Definição da constraint status'
SELECT pg_get_constraintdef(oid) as status_constraint_def
FROM pg_constraint 
WHERE conrelid = 'categories'::regclass 
  AND conname = 'categories_status_check';

\echo ''

-- ============================================================
-- 2. VALIDAÇÃO DE DADOS
-- ============================================================

\echo '2. VALIDAÇÃO DE DADOS'
\echo '----------------------------------------'

-- 2.1 Coluna status existe
\echo '2.1 Coluna status (esperado: status, character varying, NO, ''active'')'
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'categories' 
  AND column_name = 'status';

-- 2.2 Distribuição de status
\echo '2.2 Distribuição de status'
SELECT 
  COALESCE(status::text, 'NULL') as status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM categories
GROUP BY status
ORDER BY count DESC;

-- 2.3 Status NULL (deve ser 0)
\echo '2.3 Status NULL (esperado: 0)'
SELECT COUNT(*) as null_status_count
FROM categories
WHERE status IS NULL;

-- 2.4 Status inválidos (deve ser 0)
\echo '2.4 Status inválidos (esperado: 0)'
SELECT COUNT(*) as invalid_status_count
FROM categories
WHERE status IS NOT NULL
  AND status NOT IN ('active', 'auto_active', 'pending', 'rejected', 'archived');

-- 2.5 Categorias raiz ativas
\echo '2.5 Categorias raiz ativas (esperado: > 0 após seeds)'
SELECT COUNT(*) as root_categories_count
FROM categories
WHERE parent_id IS NULL 
  AND status IN ('active', 'auto_active');

\echo ''

-- ============================================================
-- 3. VALIDAÇÃO DE INTEGRIDADE REFERENCIAL
-- ============================================================

\echo '3. VALIDAÇÃO DE INTEGRIDADE REFERENCIAL'
\echo '----------------------------------------'

-- 3.1 FKs quebradas em user_skills_categories (deve ser 0)
\echo '3.1 FKs quebradas em user_skills_categories (esperado: 0)'
SELECT COUNT(*) as broken_fks_count
FROM user_skills_categories usc
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.category_id = usc.category_id
);

-- 3.2 FKs quebradas em outras tabelas
\echo '3.2 FKs quebradas em outras tabelas (esperado: todos 0)'
SELECT 
  'company_categories' as table_name,
  COUNT(*) as broken_fks
FROM company_categories cc
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.category_id = cc.category_id
)
UNION ALL
SELECT 
  'post_categories' as table_name,
  COUNT(*) as broken_fks
FROM post_categories pc
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.category_id = pc.category_id
)
UNION ALL
SELECT 
  'product_categories' as table_name,
  COUNT(*) as broken_fks
FROM product_categories prc
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.category_id = prc.category_id
)
UNION ALL
SELECT 
  'service_categories' as table_name,
  COUNT(*) as broken_fks
FROM service_categories sc
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.category_id = sc.category_id
);

\echo ''

-- ============================================================
-- 4. VALIDAÇÃO DE INTEGRIDADE HIERÁRQUICA
-- ============================================================

\echo '4. VALIDAÇÃO DE INTEGRIDADE HIERÁRQUICA'
\echo '----------------------------------------'

-- 4.1 Parent_id quebrados (deve ser 0)
\echo '4.1 Parent_id quebrados (esperado: 0)'
SELECT COUNT(*) as broken_parents_count
FROM categories c
WHERE c.parent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM categories p WHERE p.category_id = c.parent_id
  );

-- 4.2 Consistência path/level (deve ser 0)
\echo '4.2 Consistência path/level (esperado: 0)'
SELECT COUNT(*) as inconsistent_path_level_count
FROM categories
WHERE level != array_length(path, 1) - 1;

-- 4.3 Verificar ciclos na hierarquia (deve ser 0)
\echo '4.3 Ciclos na hierarquia (esperado: 0)'
WITH RECURSIVE category_tree AS (
  SELECT category_id, parent_id, ARRAY[category_id] as path
  FROM categories
  WHERE parent_id IS NULL
  
  UNION ALL
  
  SELECT c.category_id, c.parent_id, ct.path || c.category_id
  FROM categories c
  JOIN category_tree ct ON c.parent_id = ct.category_id
  WHERE c.category_id <> ALL(ct.path)
)
SELECT COUNT(*) as cycles_count
FROM category_tree
WHERE category_id = ANY(path[1:array_length(path, 1)-1]);

\echo ''

-- ============================================================
-- 5. VALIDAÇÃO DE PERFORMANCE
-- ============================================================

\echo '5. VALIDAÇÃO DE PERFORMANCE'
\echo '----------------------------------------'

-- 5.1 Tamanho da tabela categories
\echo '5.1 Tamanho da tabela categories'
SELECT 
  pg_size_pretty(pg_total_relation_size('categories')) as total_size,
  pg_size_pretty(pg_relation_size('categories')) as table_size,
  pg_size_pretty(pg_indexes_size('categories')) as indexes_size,
  (SELECT COUNT(*) FROM categories) as row_count;

-- 5.2 Índices em categories
\echo '5.2 Índices em categories'
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'categories'
ORDER BY indexname;

\echo ''

-- ============================================================
-- 6. RESUMO FINAL
-- ============================================================

\echo '========================================'
\echo 'RESUMO FINAL'
\echo '========================================'

DO $$
DECLARE
  cnpj_ok BOOLEAN;
  status_ok BOOLEAN;
  fks_ok BOOLEAN;
  hierarchy_ok BOOLEAN;
BEGIN
  -- Verificar constraints
  SELECT COUNT(*) = 1 INTO cnpj_ok
  FROM pg_constraint 
  WHERE conrelid = 'companies'::regclass 
    AND conname = 'companies_cnpj_format';
  
  SELECT COUNT(*) = 1 INTO status_ok
  FROM pg_constraint 
  WHERE conrelid = 'categories'::regclass 
    AND conname = 'categories_status_check';
  
  -- Verificar FKs
  SELECT COUNT(*) = 0 INTO fks_ok
  FROM user_skills_categories usc
  WHERE NOT EXISTS (
    SELECT 1 FROM categories c WHERE c.category_id = usc.category_id
  );
  
  -- Verificar hierarquia
  SELECT COUNT(*) = 0 INTO hierarchy_ok
  FROM categories c
  WHERE c.parent_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM categories p WHERE p.category_id = c.parent_id
    );
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Constraint CNPJ: %', CASE WHEN cnpj_ok THEN 'OK' ELSE 'FALHOU' END;
  RAISE NOTICE '✅ Constraint Status: %', CASE WHEN status_ok THEN 'OK' ELSE 'FALHOU' END;
  RAISE NOTICE '✅ FKs Quebradas: %', CASE WHEN fks_ok THEN 'OK' ELSE 'FALHOU' END;
  RAISE NOTICE '✅ Hierarquia: %', CASE WHEN hierarchy_ok THEN 'OK' ELSE 'FALHOU' END;
  RAISE NOTICE '';
  
  IF cnpj_ok AND status_ok AND fks_ok AND hierarchy_ok THEN
    RAISE NOTICE '✅ MIGRATION 103 VALIDADA COM SUCESSO';
  ELSE
    RAISE WARNING '⚠️ ALGUMAS VALIDAÇÕES FALHARAM - REVISAR RESULTADOS ACIMA';
  END IF;
END $$;

\echo ''
\echo '========================================'
\echo 'FIM DA VALIDAÇÃO'
\echo '========================================'













