-- ============================================================
-- UNIFICARD — MIGRATION 104
-- Arquivo: 104_fix_company_status_values.sql
-- Tipo: CORREÇÃO CRÍTICA (Alinhamento TypeScript ↔ PostgreSQL)
-- Banco alvo: PostgreSQL 14+
--
-- CONTEXTO
-- O backend usa CompanyStatus do @unificard/contracts:
--   'DRAFT' | 'PROVISIONAL' | 'VERIFIED' | 'APPROVED' | 'SUSPENDED'
--
-- Mas o banco (migration 073) definiu valores diferentes:
--   'draft' | 'manual' | 'pending_doc' | 'validated'
--
-- Isso causa constraint violation ao criar empresa.
--
-- SOLUÇÃO
-- Alinhar o banco aos valores do TypeScript (fonte de verdade).
--
-- MAPEAMENTO
-- | Banco (antigo)   | TypeScript (novo) | Semântica                    |
-- |------------------|-------------------|------------------------------|
-- | draft            | DRAFT             | Criada, invisível            |
-- | manual           | PROVISIONAL       | Ativa com limites            |
-- | pending_doc      | PROVISIONAL       | Ativa com limites            |
-- | validated        | VERIFIED          | Validada presencialmente     |
--
-- IDEMPOTÊNCIA
-- • Pode ser executada múltiplas vezes com segurança
-- • Usa IF EXISTS e guards em todas as operações
--
-- ============================================================


-- ============================================================
-- FASE 1: REMOVER CONSTRAINT ANTIGA
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '=== FASE 1: Removendo constraint antiga ===';
  
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_company_status_check'
  ) THEN
    ALTER TABLE companies DROP CONSTRAINT companies_company_status_check;
    RAISE NOTICE 'Constraint companies_company_status_check removida';
  ELSE
    RAISE NOTICE 'Constraint companies_company_status_check não existe (já removida)';
  END IF;
  
  RAISE NOTICE '✅ FASE 1 concluída';
END $$;


-- ============================================================
-- FASE 2: MIGRAR VALORES EXISTENTES
-- ============================================================

DO $$
DECLARE
  updated_draft INTEGER := 0;
  updated_manual INTEGER := 0;
  updated_pending INTEGER := 0;
  updated_validated INTEGER := 0;
BEGIN
  RAISE NOTICE '=== FASE 2: Migrando valores existentes ===';
  
  -- draft → DRAFT
  UPDATE companies SET company_status = 'DRAFT' WHERE company_status = 'draft';
  GET DIAGNOSTICS updated_draft = ROW_COUNT;
  IF updated_draft > 0 THEN
    RAISE NOTICE 'Migradas % empresas: draft → DRAFT', updated_draft;
  END IF;
  
  -- manual → PROVISIONAL
  UPDATE companies SET company_status = 'PROVISIONAL' WHERE company_status = 'manual';
  GET DIAGNOSTICS updated_manual = ROW_COUNT;
  IF updated_manual > 0 THEN
    RAISE NOTICE 'Migradas % empresas: manual → PROVISIONAL', updated_manual;
  END IF;
  
  -- pending_doc → PROVISIONAL
  UPDATE companies SET company_status = 'PROVISIONAL' WHERE company_status = 'pending_doc';
  GET DIAGNOSTICS updated_pending = ROW_COUNT;
  IF updated_pending > 0 THEN
    RAISE NOTICE 'Migradas % empresas: pending_doc → PROVISIONAL', updated_pending;
  END IF;
  
  -- validated → VERIFIED
  UPDATE companies SET company_status = 'VERIFIED' WHERE company_status = 'validated';
  GET DIAGNOSTICS updated_validated = ROW_COUNT;
  IF updated_validated > 0 THEN
    RAISE NOTICE 'Migradas % empresas: validated → VERIFIED', updated_validated;
  END IF;
  
  -- Casos edge: valores NULL ou vazios → DRAFT
  UPDATE companies SET company_status = 'DRAFT' WHERE company_status IS NULL OR company_status = '';
  
  RAISE NOTICE '✅ FASE 2 concluída';
END $$;


-- ============================================================
-- FASE 3: CRIAR NOVA CONSTRAINT
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '=== FASE 3: Criando nova constraint ===';
  
  -- Verificar se já existe (idempotência)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_company_status_check'
  ) THEN
    ALTER TABLE companies
    ADD CONSTRAINT companies_company_status_check
    CHECK (company_status IN ('DRAFT', 'PROVISIONAL', 'VERIFIED', 'APPROVED', 'SUSPENDED'));
    
    RAISE NOTICE 'Constraint companies_company_status_check criada com valores TypeScript';
  ELSE
    RAISE NOTICE 'Constraint companies_company_status_check já existe';
  END IF;
  
  RAISE NOTICE '✅ FASE 3 concluída';
END $$;


-- ============================================================
-- FASE 4: ATUALIZAR DEFAULT
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '=== FASE 4: Atualizando default ===';
  
  ALTER TABLE companies ALTER COLUMN company_status SET DEFAULT 'DRAFT';
  
  RAISE NOTICE 'Default de company_status alterado para DRAFT';
  RAISE NOTICE '✅ FASE 4 concluída';
END $$;


-- ============================================================
-- FASE 5: VERIFICAR INTEGRIDADE
-- ============================================================

DO $$
DECLARE
  invalid_count INTEGER;
  total_companies INTEGER;
BEGIN
  RAISE NOTICE '=== FASE 5: Verificando integridade ===';
  
  -- Contar empresas com valores inválidos
  SELECT COUNT(*) INTO invalid_count
  FROM companies
  WHERE company_status NOT IN ('DRAFT', 'PROVISIONAL', 'VERIFIED', 'APPROVED', 'SUSPENDED');
  
  IF invalid_count > 0 THEN
    RAISE WARNING '⚠️ Existem % empresas com company_status inválido!', invalid_count;
    RAISE WARNING 'Execute: SELECT company_id, company_status FROM companies WHERE company_status NOT IN (...)';
  END IF;
  
  -- Contar total
  SELECT COUNT(*) INTO total_companies FROM companies;
  
  RAISE NOTICE 'Total de empresas: %', total_companies;
  RAISE NOTICE '✅ FASE 5 concluída';
END $$;


-- ============================================================
-- FASE 6: RELATÓRIO FINAL
-- ============================================================

DO $$
DECLARE
  status_counts RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  MIGRATION 104 - RELATÓRIO FINAL';
  RAISE NOTICE '========================================';
  
  -- Distribuição de status
  RAISE NOTICE '';
  RAISE NOTICE '📊 DISTRIBUIÇÃO DE company_status:';
  
  FOR status_counts IN
    SELECT company_status, COUNT(*) as qtd
    FROM companies
    GROUP BY company_status
    ORDER BY company_status
  LOOP
    RAISE NOTICE '   %: %', status_counts.company_status, status_counts.qtd;
  END LOOP;
  
  -- Verificar constraint
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_company_status_check'
  ) THEN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Constraint companies_company_status_check: ATIVA';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '❌ Constraint companies_company_status_check: AUSENTE';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MIGRATION 104 CONCLUÍDA COM SUCESSO';
  RAISE NOTICE '========================================';
END $$;


-- ============================================================
-- COMENTÁRIOS ATUALIZADOS
-- ============================================================

COMMENT ON COLUMN companies.company_status IS
  'Status do cadastro: DRAFT (invisível), PROVISIONAL (ativo com limites), VERIFIED (validado), APPROVED (pleno), SUSPENDED (bloqueado)';


-- ============================================================
-- FIM 104_fix_company_status_values.sql
-- ============================================================
