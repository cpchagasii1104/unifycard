-- ============================================================
-- UNIFICARD - MIGRATION 304
-- Company Canonical Birth - Nascimento Canônico de Company
-- ============================================================
--
-- OBJETIVO:
-- Permitir que Company exista em estado CREATED sem Actor, Page, Service
-- ou qualquer capacidade operacional.
--
-- REGRAS PÉTREAS:
-- - Company pode existir sem Actor (global_user_id nullable)
-- - Company pode existir sem Page, Service, Wallet, Card, ERP, CRM, Agenda
-- - É proibido rollback ontológico (apagamento de Company) por falha em entidade derivada
-- - Formulário NÃO cria capacidade, apenas existência canônica
--
-- ============================================================

BEGIN;

-- ============================================================
-- 1) ADICIONAR COLUNA state (se não existir)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'state'
  ) THEN
    ALTER TABLE companies ADD COLUMN state VARCHAR(20) DEFAULT 'CREATED';
    
    -- Atualizar empresas existentes para 'CREATED' se NULL
    UPDATE companies SET state = 'CREATED' WHERE state IS NULL;
    
    -- Tornar NOT NULL após atualizar
    ALTER TABLE companies ALTER COLUMN state SET NOT NULL;
    ALTER TABLE companies ALTER COLUMN state SET DEFAULT 'CREATED';
  END IF;
END $$;

-- ============================================================
-- 2) ADICIONAR COLUNAS CANÔNICAS (se não existirem)
-- ============================================================
DO $$
BEGIN
  -- legal_name (nome legal da empresa)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'legal_name'
  ) THEN
    ALTER TABLE companies ADD COLUMN legal_name TEXT;
    -- Migrar company_name para legal_name se existir
    UPDATE companies SET legal_name = company_name WHERE legal_name IS NULL AND company_name IS NOT NULL;
  END IF;

  -- document_type (CPF | CNPJ)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'document_type'
  ) THEN
    ALTER TABLE companies ADD COLUMN document_type VARCHAR(10);
    -- Empresas existentes com CNPJ recebem 'CNPJ'
    UPDATE companies SET document_type = 'CNPJ' WHERE document_type IS NULL AND cnpj IS NOT NULL;
  END IF;

  -- document_number (número do documento, normalizado)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'document_number'
  ) THEN
    ALTER TABLE companies ADD COLUMN document_number VARCHAR(20);
    -- Migrar cnpj para document_number se existir
    UPDATE companies SET document_number = cnpj WHERE document_number IS NULL AND cnpj IS NOT NULL;
  END IF;
END $$;

-- ============================================================
-- 3) ADICIONAR tenant_id se não existir (ANTES dos índices)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'tenant_id'
  ) THEN
    -- Adicionar tenant_id (obrigatório para isolamento)
    ALTER TABLE companies ADD COLUMN tenant_id UUID;
    
    -- Adicionar foreign key para tenants (se tabela existir)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
      ALTER TABLE companies
        ADD CONSTRAINT companies_tenant_id_fkey
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(tenant_id)
        ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- ============================================================
-- 4) TORNAR global_user_id NULLABLE
-- ============================================================
-- Company pode existir sem Actor (regra pétea)
DO $$
BEGIN
  -- Remover constraint NOT NULL se existir
  ALTER TABLE companies ALTER COLUMN global_user_id DROP NOT NULL;
  
  -- Remover constraint de foreign key CASCADE (mantém referência, mas permite NULL)
  -- Não removemos a FK, apenas permitimos NULL
END $$;

-- ============================================================
-- 5) REMOVER/MODIFICAR CONSTRAINT UNIQUE que exige global_user_id
-- ============================================================
DO $$
BEGIN
  -- Remover constraint antiga se existir
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'companies_unique_user_cnpj'
  ) THEN
    ALTER TABLE companies DROP CONSTRAINT companies_unique_user_cnpj;
  END IF;
  
  -- Criar nova constraint que permite NULL em global_user_id
  -- Mas mantém unicidade de document_number por tenant (se global_user_id for NULL)
  -- E unicidade de (global_user_id, document_number) se global_user_id não for NULL
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'companies_unique_document'
  ) THEN
    -- Constraint parcial: se global_user_id é NULL, document_number deve ser único por tenant
    -- Se global_user_id não é NULL, (global_user_id, document_number) deve ser único
    -- Isso é complexo, então vamos criar um índice único parcial
    CREATE UNIQUE INDEX IF NOT EXISTS companies_unique_document_no_user
      ON companies (tenant_id, document_number)
      WHERE global_user_id IS NULL;
    
    CREATE UNIQUE INDEX IF NOT EXISTS companies_unique_document_with_user
      ON companies (global_user_id, document_number)
      WHERE global_user_id IS NOT NULL;
  END IF;
END $$;

-- ============================================================
-- 6) ADICIONAR CHECK CONSTRAINT para document_type
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'companies_document_type_check'
  ) THEN
    ALTER TABLE companies
      ADD CONSTRAINT companies_document_type_check
      CHECK (document_type IS NULL OR document_type IN ('CPF', 'CNPJ'));
  END IF;
END $$;

-- ============================================================
-- 7) ADICIONAR CHECK CONSTRAINT para state
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'companies_state_check'
  ) THEN
    ALTER TABLE companies
      ADD CONSTRAINT companies_state_check
      CHECK (state IN ('CREATED', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'CLOSED'));
  END IF;
END $$;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON COLUMN companies.state IS 
  'Estado canônico da empresa. CREATED = nascimento canônico, sem capacidade operacional.';
COMMENT ON COLUMN companies.legal_name IS 
  'Nome legal da empresa (razão social).';
COMMENT ON COLUMN companies.document_type IS 
  'Tipo de documento: CPF ou CNPJ.';
COMMENT ON COLUMN companies.document_number IS 
  'Número do documento (CPF ou CNPJ), normalizado (apenas números).';
COMMENT ON COLUMN companies.global_user_id IS 
  'ID do usuário global associado (NULLABLE - Company pode existir sem Actor).';

COMMIT;

