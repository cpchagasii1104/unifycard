-- ============================================================
-- SCRIPT DE CORREÇÃO PÓS-MIGRATION
-- Arquivo: fix-post-migration-issues.sql
-- Objetivo: Corrigir problemas de schema e dados após migrations
-- ============================================================

-- ============================================================
-- 1) VERIFICAR E CORRIGIR CONSTRAINT CNPJ
-- ============================================================

-- Verificar se constraint existe e qual formato espera
DO $$
BEGIN
  -- Remover constraint antiga se existir (pode estar esperando formato com máscara)
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'companies_cnpj_format'
  ) THEN
    ALTER TABLE companies
      DROP CONSTRAINT companies_cnpj_format;
    
    RAISE NOTICE 'Constraint companies_cnpj_format removida';
  END IF;
  
  -- Criar constraint nova: apenas números (14 dígitos)
  ALTER TABLE companies
    ADD CONSTRAINT companies_cnpj_format
    CHECK (cnpj ~ '^[0-9]{14}$');
  
  RAISE NOTICE 'Constraint companies_cnpj_format criada (apenas números)';
END $$;

-- ============================================================
-- 2) VERIFICAR E CORRIGIR REGISTROS ÓRFÃOS EM ACCOUNTS
-- ============================================================

-- Verificar se há registros com owner_id NULL
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM accounts
  WHERE owner_id IS NULL;
  
  IF orphan_count > 0 THEN
    RAISE NOTICE 'Encontrados % registros órfãos em accounts (owner_id NULL)', orphan_count;
    
    -- Opção 1: Deletar registros órfãos (se não forem importantes)
    -- DELETE FROM accounts WHERE owner_id IS NULL;
    
    -- Opção 2: Atualizar para um owner_id válido (se houver lógica de negócio)
    -- UPDATE accounts SET owner_id = '...' WHERE owner_id IS NULL;
    
    RAISE NOTICE 'Ação manual necessária para corrigir registros órfãos';
  ELSE
    RAISE NOTICE 'Nenhum registro órfão encontrado em accounts';
  END IF;
END $$;

-- ============================================================
-- 3) VERIFICAR TIPO DE COLUNA KEYWORDS EM CATEGORIES
-- ============================================================

-- Verificar se keywords é TEXT[] ou JSONB
DO $$
DECLARE
  keywords_type TEXT;
BEGIN
  SELECT data_type INTO keywords_type
  FROM information_schema.columns
  WHERE table_name = 'categories'
    AND column_name = 'keywords';
  
  IF keywords_type IS NULL THEN
    RAISE NOTICE 'Coluna keywords não existe em categories';
  ELSIF keywords_type = 'ARRAY' THEN
    -- Verificar se é TEXT[]
    SELECT udt_name INTO keywords_type
    FROM information_schema.columns
    WHERE table_name = 'categories'
      AND column_name = 'keywords';
    
    IF keywords_type = 'text' THEN
      RAISE NOTICE 'Coluna keywords é TEXT[] (correto)';
    ELSE
      RAISE NOTICE 'Coluna keywords é %[] (verificar se está correto)', keywords_type;
    END IF;
  ELSE
    RAISE NOTICE 'Coluna keywords é % (esperado: ARRAY)', keywords_type;
  END IF;
END $$;

-- ============================================================
-- 4) VERIFICAR SE CATEGORIAS EXISTEM
-- ============================================================

DO $$
DECLARE
  category_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO category_count
  FROM categories;
  
  IF category_count = 0 THEN
    RAISE NOTICE 'Tabela categories está VAZIA - executar seed de categorias';
    RAISE NOTICE 'Comando: npm run seed:dev:categories';
  ELSE
    RAISE NOTICE 'Tabela categories tem % registros', category_count;
    
    -- Verificar categorias raiz
    SELECT COUNT(*) INTO category_count
    FROM categories
    WHERE parent_id IS NULL;
    
    RAISE NOTICE 'Categorias raiz: %', category_count;
  END IF;
END $$;

-- ============================================================
-- 5) VERIFICAR EXTENSÕES NECESSÁRIAS
-- ============================================================

-- Verificar pg_trgm (para busca fuzzy)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
  ) THEN
    RAISE NOTICE 'Extensão pg_trgm está instalada';
  ELSE
    RAISE NOTICE 'Extensão pg_trgm NÃO está instalada - executar: CREATE EXTENSION IF NOT EXISTS pg_trgm;';
  END IF;
END $$;

-- ============================================================
-- 6) VERIFICAR TABELAS DE BANK/TRANSPARENCY
-- ============================================================

DO $$
DECLARE
  table_exists BOOLEAN;
  row_count INTEGER;
BEGIN
  -- Verificar accounts
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'accounts'
  ) INTO table_exists;
  
  IF table_exists THEN
    SELECT COUNT(*) INTO row_count FROM accounts;
    RAISE NOTICE 'Tabela accounts existe com % registros', row_count;
  ELSE
    RAISE NOTICE 'Tabela accounts NÃO existe';
  END IF;
  
  -- Verificar ledger
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ledger'
  ) INTO table_exists;
  
  IF table_exists THEN
    SELECT COUNT(*) INTO row_count FROM ledger;
    RAISE NOTICE 'Tabela ledger existe com % registros', row_count;
  ELSE
    RAISE NOTICE 'Tabela ledger NÃO existe';
  END IF;
  
  -- Verificar transactions
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'transactions'
  ) INTO table_exists;
  
  IF table_exists THEN
    SELECT COUNT(*) INTO row_count FROM transactions;
    RAISE NOTICE 'Tabela transactions existe com % registros', row_count;
  ELSE
    RAISE NOTICE 'Tabela transactions NÃO existe';
  END IF;
END $$;

-- ============================================================
-- 7) VERIFICAR TABELA CULTURAL_EVENTS
-- ============================================================

DO $$
DECLARE
  table_exists BOOLEAN;
  row_count INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'cultural_events'
  ) INTO table_exists;
  
  IF table_exists THEN
    SELECT COUNT(*) INTO row_count FROM cultural_events;
    RAISE NOTICE 'Tabela cultural_events existe com % registros', row_count;
  ELSE
    RAISE NOTICE 'Tabela cultural_events NÃO existe - feature pode não estar disponível';
  END IF;
END $$;

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================














