-- ============================================================
-- UNIFICARD — MIGRATION 103 (CONSOLIDAÇÃO)
-- Arquivo: 103_consolidation_fix_all_issues.sql
-- Tipo: CORREÇÃO CRÍTICA (Pós-Auditoria 01/01/2026)
-- Banco alvo: PostgreSQL 14+
--
-- OBJETIVO:
-- Resolver todos os problemas identificados na auditoria:
-- 1. Constraints duplicadas de CNPJ
-- 2. Categorias com status incorreto
-- 3. Garantir integridade referencial
--
-- IDEMPOTÊNCIA:
-- • Pode ser executada múltiplas vezes com segurança
-- • Usa IF EXISTS / IF NOT EXISTS em todas as operações
--
-- ============================================================

-- ============================================================
-- FASE 1: CORRIGIR CONSTRAINTS DE CNPJ EM COMPANIES
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '=== FASE 1: Corrigindo constraints de CNPJ ===';
  
  -- Remover constraint companies_cnpj_format (se existir)
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_cnpj_format'
  ) THEN
    ALTER TABLE companies DROP CONSTRAINT companies_cnpj_format;
    RAISE NOTICE 'Constraint companies_cnpj_format removida';
  END IF;
  
  -- Remover constraint companies_cnpj_digits_only (se existir)
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_cnpj_digits_only'
  ) THEN
    ALTER TABLE companies DROP CONSTRAINT companies_cnpj_digits_only;
    RAISE NOTICE 'Constraint companies_cnpj_digits_only removida';
  END IF;
  
  -- Criar constraint única e definitiva
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_cnpj_format'
  ) THEN
    ALTER TABLE companies
    ADD CONSTRAINT companies_cnpj_format
    CHECK (cnpj ~ '^[0-9]{14}$');
    RAISE NOTICE 'Constraint companies_cnpj_format criada (apenas 14 dígitos)';
  END IF;
  
  RAISE NOTICE '✅ FASE 1 concluída';
END $$;

-- ============================================================
-- FASE 2: GARANTIR COLUNA STATUS EM CATEGORIES
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '=== FASE 2: Verificando coluna status em categories ===';
  
  -- Verificar se coluna status existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'status'
  ) THEN
    -- Criar coluna status
    ALTER TABLE categories
    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
    RAISE NOTICE 'Coluna status criada em categories';
  ELSE
    RAISE NOTICE 'Coluna status já existe em categories';
  END IF;
  
  RAISE NOTICE '✅ FASE 2 concluída';
END $$;

-- ============================================================
-- FASE 3: GARANTIR CONSTRAINT DE STATUS EM CATEGORIES
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '=== FASE 3: Verificando constraint de status ===';
  
  -- Remover constraint antiga (se existir com valores incompletos)
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_status_check'
  ) THEN
    ALTER TABLE categories DROP CONSTRAINT categories_status_check;
    RAISE NOTICE 'Constraint categories_status_check antiga removida';
  END IF;
  
  -- Criar constraint com todos os valores válidos
  ALTER TABLE categories
  ADD CONSTRAINT categories_status_check
  CHECK (status IN ('active', 'auto_active', 'pending', 'rejected', 'archived'));
  RAISE NOTICE 'Constraint categories_status_check criada com valores completos';
  
  RAISE NOTICE '✅ FASE 3 concluída';
END $$;

-- ============================================================
-- FASE 4: CORRIGIR CATEGORIAS COM STATUS INVÁLIDO
-- ============================================================

DO $$
DECLARE
  updated_null INTEGER;
  updated_pending INTEGER;
  total_active INTEGER;
BEGIN
  RAISE NOTICE '=== FASE 4: Corrigindo status de categorias ===';
  
  -- Atualizar categorias com status NULL para 'active'
  UPDATE categories SET status = 'active' WHERE status IS NULL;
  GET DIAGNOSTICS updated_null = ROW_COUNT;
  
  IF updated_null > 0 THEN
    RAISE NOTICE 'Atualizadas % categorias de NULL para active', updated_null;
  END IF;
  
  -- Verificar total de categorias ativas
  SELECT COUNT(*) INTO total_active FROM categories WHERE status IN ('active', 'auto_active');
  RAISE NOTICE 'Total de categorias ativas (active + auto_active): %', total_active;
  
  -- AVISO: Não forçar pending para active automaticamente
  -- Isso pode ser decisão de negócio
  SELECT COUNT(*) INTO updated_pending FROM categories WHERE status = 'pending';
  IF updated_pending > 0 THEN
    RAISE NOTICE '⚠️ Existem % categorias com status pending - revisar manualmente se necessário', updated_pending;
  END IF;
  
  RAISE NOTICE '✅ FASE 4 concluída';
END $$;

-- ============================================================
-- FASE 5: VERIFICAR CATEGORIAS RAIZ
-- ============================================================

DO $$
DECLARE
  root_count INTEGER;
BEGIN
  RAISE NOTICE '=== FASE 5: Verificando categorias raiz ===';
  
  SELECT COUNT(*) INTO root_count 
  FROM categories 
  WHERE parent_id IS NULL AND status IN ('active', 'auto_active');
  
  IF root_count = 0 THEN
    RAISE WARNING '⚠️ ATENÇÃO: Nenhuma categoria raiz encontrada! Execute os seeds.';
    RAISE WARNING 'Comandos:';
    RAISE WARNING '  npx ts-node src/scripts/seed-professional-categories.ts';
    RAISE WARNING '  npx ts-node src/scripts/seed-physical-categories.ts';
    RAISE WARNING '  npx ts-node src/scripts/seed-learning-categories.ts';
  ELSE
    RAISE NOTICE '✅ Encontradas % categorias raiz ativas', root_count;
  END IF;
  
  RAISE NOTICE '✅ FASE 5 concluída';
END $$;

-- ============================================================
-- FASE 6: LIMPAR FKs QUEBRADAS EM USER_SKILLS_CATEGORIES
-- ============================================================

DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  RAISE NOTICE '=== FASE 6: Limpando FKs quebradas ===';
  
  -- Remover referências a categorias que não existem
  DELETE FROM user_skills_categories usc
  WHERE NOT EXISTS (
    SELECT 1 FROM categories c WHERE c.category_id = usc.category_id
  );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  IF deleted_count > 0 THEN
    RAISE NOTICE 'Removidas % referências a categorias inexistentes', deleted_count;
  ELSE
    RAISE NOTICE 'Nenhuma FK quebrada encontrada';
  END IF;
  
  RAISE NOTICE '✅ FASE 6 concluída';
END $$;

-- ============================================================
-- FASE 7: GARANTIR EXTENSÕES NECESSÁRIAS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- FASE 8: RELATÓRIO FINAL
-- ============================================================

DO $$
DECLARE
  cat_total INTEGER;
  cat_active INTEGER;
  cat_root INTEGER;
  comp_total INTEGER;
  cnpj_constraints INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  MIGRATION 103 - RELATÓRIO FINAL';
  RAISE NOTICE '========================================';
  
  -- Categorias
  SELECT COUNT(*) INTO cat_total FROM categories;
  SELECT COUNT(*) INTO cat_active FROM categories WHERE status IN ('active', 'auto_active');
  SELECT COUNT(*) INTO cat_root FROM categories WHERE parent_id IS NULL AND status IN ('active', 'auto_active');
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 CATEGORIAS:';
  RAISE NOTICE '   Total: %', cat_total;
  RAISE NOTICE '   Ativas: %', cat_active;
  RAISE NOTICE '   Raiz: %', cat_root;
  
  -- Companies
  SELECT COUNT(*) INTO comp_total FROM companies;
  
  RAISE NOTICE '';
  RAISE NOTICE '🏢 EMPRESAS:';
  RAISE NOTICE '   Total: %', comp_total;
  
  -- Constraints CNPJ
  SELECT COUNT(*) INTO cnpj_constraints 
  FROM pg_constraint 
  WHERE conrelid = 'companies'::regclass AND conname LIKE '%cnpj%';
  
  RAISE NOTICE '';
  RAISE NOTICE '🔒 CONSTRAINTS CNPJ: %', cnpj_constraints;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  
  -- Alertas finais
  IF cat_root = 0 THEN
    RAISE NOTICE '⚠️ AÇÃO NECESSÁRIA: Execute os seeds de categorias';
  END IF;
  
  IF cnpj_constraints != 1 THEN
    RAISE NOTICE '⚠️ AÇÃO NECESSÁRIA: Verifique constraints de CNPJ';
  END IF;
  
  IF cat_active > 0 AND cnpj_constraints = 1 THEN
    RAISE NOTICE '✅ SISTEMA PRONTO PARA USO';
  END IF;
  
  RAISE NOTICE '========================================';
END $$;

-- ============================================================
-- FIM DA MIGRATION 103
-- ============================================================
