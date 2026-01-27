-- ============================================================
-- UNIFICARD — MIGRATION 100
-- Arquivo: 100_fix_post_migration_issues.sql
-- Tipo: CORREÇÃO CRÍTICA (Pós-Migration)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- Após migrations recentes, vários problemas surgiram:
-- 1. Constraint CNPJ esperando formato errado
-- 2. Registros órfãos em accounts (owner_id NULL)
-- 3. Queries usando funções incorretas para TEXT[]
--
-- OBJETIVO
-- Corrigir todos os problemas de schema e dados pós-migration
--
-- DEPENDÊNCIAS
-- • companies (migration 047)
-- • accounts (migration 001)
-- • categories (migration 040, 042)
--
-- IDEMPOTÊNCIA
-- • Todas as alterações são idempotentes
-- • Pode ser executada múltiplas vezes com segurança
--
-- ============================================================

-- ============================================================
-- 1) CORRIGIR CONSTRAINT CNPJ EM COMPANIES
-- ============================================================

-- Remover constraint antiga (se existir - pode estar esperando formato com máscara)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'companies_cnpj_format'
  ) THEN
    ALTER TABLE companies
      DROP CONSTRAINT companies_cnpj_format;
    
    RAISE NOTICE 'Constraint companies_cnpj_format removida';
  END IF;
END $$;

-- Criar constraint nova: apenas números (14 dígitos)
-- Isso alinha com o código que normaliza CNPJ removendo máscara
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'companies_cnpj_format'
  ) THEN
    ALTER TABLE companies
      ADD CONSTRAINT companies_cnpj_format
      CHECK (cnpj ~ '^[0-9]{14}$');
    
    RAISE NOTICE 'Constraint companies_cnpj_format criada (apenas números)';
  ELSE
    RAISE NOTICE 'Constraint companies_cnpj_format já existe';
  END IF;
END $$;

-- ============================================================
-- 2) CORRIGIR REGISTROS ÓRFÃOS EM ACCOUNTS
-- ============================================================

-- Verificar e corrigir registros com owner_id NULL
-- Se houver registros órfãos, deletá-los (não podem ser usados)
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  -- Contar registros órfãos
  SELECT COUNT(*) INTO orphan_count
  FROM accounts
  WHERE owner_id IS NULL;
  
  IF orphan_count > 0 THEN
    RAISE NOTICE 'Encontrados % registros órfãos em accounts (owner_id NULL)', orphan_count;
    
    -- Deletar registros órfãos (não podem ser usados sem owner_id)
    DELETE FROM accounts WHERE owner_id IS NULL;
    
    RAISE NOTICE 'Registros órfãos removidos de accounts';
  ELSE
    RAISE NOTICE 'Nenhum registro órfão encontrado em accounts';
  END IF;
END $$;

-- Garantir que constraint NOT NULL está aplicada
DO $$
BEGIN
  -- Verificar se coluna permite NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts'
      AND column_name = 'owner_id'
      AND is_nullable = 'YES'
  ) THEN
    -- Atualizar para NOT NULL (já deve estar, mas garantir)
    ALTER TABLE accounts
      ALTER COLUMN owner_id SET NOT NULL;
    
    RAISE NOTICE 'Coluna owner_id em accounts configurada como NOT NULL';
  ELSE
    RAISE NOTICE 'Coluna owner_id em accounts já é NOT NULL';
  END IF;
END $$;

-- ============================================================
-- 3) VERIFICAR E CORRIGIR SCHEMA DE CATEGORIES
-- ============================================================

-- Verificar se coluna keywords existe e é do tipo correto (TEXT[])
DO $$
DECLARE
  keywords_type TEXT;
  keywords_udt TEXT;
BEGIN
  -- Verificar se coluna existe
  SELECT data_type, udt_name INTO keywords_type, keywords_udt
  FROM information_schema.columns
  WHERE table_name = 'categories'
    AND column_name = 'keywords';
  
  IF keywords_type IS NULL THEN
    RAISE NOTICE 'Coluna keywords não existe em categories - criando...';
    
    -- Criar coluna keywords como TEXT[]
    ALTER TABLE categories
      ADD COLUMN keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
    
    RAISE NOTICE 'Coluna keywords criada como TEXT[]';
  ELSIF keywords_type = 'ARRAY' AND keywords_udt = 'text' THEN
    RAISE NOTICE 'Coluna keywords é TEXT[] (correto)';
  ELSE
    RAISE WARNING 'Coluna keywords é %/% (esperado: ARRAY/text) - pode causar problemas', keywords_type, keywords_udt;
  END IF;
END $$;

-- ============================================================
-- 4) GARANTIR EXTENSÕES NECESSÁRIAS
-- ============================================================

-- pg_trgm para busca fuzzy
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- uuid-ossp para geração de UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 5) VERIFICAR ÍNDICES DE CATEGORIES
-- ============================================================

-- Garantir que índice GIN para keywords existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_categories_keywords_gin'
  ) THEN
    CREATE INDEX idx_categories_keywords_gin
      ON categories USING GIN (keywords);
    
    RAISE NOTICE 'Índice idx_categories_keywords_gin criado';
  ELSE
    RAISE NOTICE 'Índice idx_categories_keywords_gin já existe';
  END IF;
END $$;

-- Garantir que índice trigram para name existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_categories_name_trgm'
  ) THEN
    CREATE INDEX idx_categories_name_trgm
      ON categories USING GIN (name gin_trgm_ops);
    
    RAISE NOTICE 'Índice idx_categories_name_trgm criado';
  ELSE
    RAISE NOTICE 'Índice idx_categories_name_trgm já existe';
  END IF;
END $$;

-- ============================================================
-- 6) VERIFICAR STATUS COLUMN EM CATEGORIES
-- ============================================================

-- Garantir que coluna status existe (pode ter sido adicionada em migration posterior)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories'
      AND column_name = 'status'
  ) THEN
    -- Adicionar coluna status se não existir
    ALTER TABLE categories
      ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
    
    -- Adicionar constraint de valores válidos
    ALTER TABLE categories
      ADD CONSTRAINT categories_status_check
      CHECK (status IN ('active', 'pending', 'rejected', 'archived', 'auto_active'));
    
    RAISE NOTICE 'Coluna status criada em categories';
  ELSE
    RAISE NOTICE 'Coluna status já existe em categories';
  END IF;
END $$;

-- ============================================================
-- RESUMO FINAL
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION 100 - CORREÇÕES APLICADAS';
  RAISE NOTICE '========================================';
  RAISE NOTICE '1. Constraint CNPJ corrigida (apenas números)';
  RAISE NOTICE '2. Registros órfãos em accounts removidos';
  RAISE NOTICE '3. Schema de categories verificado';
  RAISE NOTICE '4. Extensões necessárias garantidas';
  RAISE NOTICE '5. Índices de categories verificados';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================
-- FIM DA MIGRATION 100
-- ============================================================






