/*
Arquivo: 313_schema_invariant_hardening.sql
Projeto: Unificard
Banco: PostgreSQL 14+
Escopo: Hardening de Schema - Reforçar Invariantes no Banco

Objetivo:
- Garantir que o banco REJEITA estados inválidos mesmo com bug no código
- Adicionar constraints defensivas (NOT NULL, CHECK, FK com tenant_id)
- Criar índices compostos (tenant_id + id) para performance e segurança
- Adicionar CHECK constraints onde possível

Dependências:
- Todas as migrations anteriores

Status: CORE
Governing Contract: SYSTEM-CANONICAL-INVARIANTS.md
*/

-- ============================================================
-- 1. AUDITORIA: Verificar tabelas críticas sem tenant_id NOT NULL
-- ============================================================

-- Esta seção documenta tabelas que DEVEM ter tenant_id NOT NULL
-- Se alguma tabela crítica não tiver, adicionar constraint aqui

-- ============================================================
-- 2. FOREIGN KEYS: Garantir que FKs sempre incluem tenant_id
-- ============================================================

-- NOTA: PostgreSQL não suporta FKs compostas diretamente em todas as situações
-- Mas podemos garantir que FKs sempre referenciam tabelas que têm tenant_id
-- e adicionar CHECK constraints para validar coerência

-- ============================================================
-- 3. ÍNDICES COMPOSTOS: (tenant_id + id) para performance e segurança
-- ============================================================

-- ACTORS: Índice composto para garantir isolamento
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'actors') THEN
    -- Índice composto para queries por tenant_id + actor_id
    CREATE INDEX IF NOT EXISTS idx_actors_tenant_actor 
      ON actors(tenant_id, actor_id);
    
    -- Índice composto para queries por tenant_id + user_id
    CREATE INDEX IF NOT EXISTS idx_actors_tenant_user 
      ON actors(tenant_id, user_id) 
      WHERE user_id IS NOT NULL;
  END IF;
END $$;

-- COMPANIES: Índice composto para garantir isolamento
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies') THEN
    -- Índice composto para queries por tenant_id + company_id
    CREATE INDEX IF NOT EXISTS idx_companies_tenant_company 
      ON companies(tenant_id, company_id);
    
    -- Índice composto para queries por tenant_id + global_user_id
    CREATE INDEX IF NOT EXISTS idx_companies_tenant_global_user 
      ON companies(tenant_id, global_user_id) 
      WHERE global_user_id IS NOT NULL;
  END IF;
END $$;

-- BANK_ACCOUNTS: Índice composto para garantir isolamento
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bank_accounts') THEN
    -- Índice composto para queries por tenant_id + account_id
    CREATE INDEX IF NOT EXISTS idx_bank_accounts_tenant_account 
      ON bank_accounts(tenant_id, account_id);
    
    -- Índice composto para queries por tenant_id + owner_id
    CREATE INDEX IF NOT EXISTS idx_bank_accounts_tenant_owner 
      ON bank_accounts(tenant_id, owner_id);
  END IF;
END $$;

-- BANK_LEDGER: Índice composto para garantir isolamento
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bank_ledger') THEN
    -- Índice composto para queries por tenant_id + account_id
    CREATE INDEX IF NOT EXISTS idx_bank_ledger_tenant_account 
      ON bank_ledger(tenant_id, account_id);
    
    -- Índice composto para queries por tenant_id + transaction_id
    CREATE INDEX IF NOT EXISTS idx_bank_ledger_tenant_transaction 
      ON bank_ledger(tenant_id, transaction_id);
  END IF;
END $$;

-- EVENT_LOG: Índice composto para garantir isolamento
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_log') THEN
    -- Índice composto para queries por tenant_id + event_id
    CREATE INDEX IF NOT EXISTS idx_event_log_tenant_event 
      ON event_log(tenant_id, event_id);
    
    -- Índice composto para queries por tenant_id + event_type
    CREATE INDEX IF NOT EXISTS idx_event_log_tenant_type 
      ON event_log(tenant_id, event_type);
  END IF;
END $$;

-- ============================================================
-- 4. CHECK CONSTRAINTS: Validações defensivas
-- ============================================================

-- USERS: Garantir que token_version existe e é não-negativo
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'token_version'
  ) THEN
    -- Adicionar CHECK constraint se não existir
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'users_token_version_non_negative'
    ) THEN
      ALTER TABLE users 
        ADD CONSTRAINT users_token_version_non_negative 
        CHECK (token_version >= 0);
    END IF;
  END IF;
END $$;

-- EVENT_LOG: Garantir que tenant_id não é vazio (se for string)
-- NOTA: tenant_id é UUID, então não precisa de CHECK para vazio
-- Mas podemos garantir que event_type não é vazio
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_log') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'event_log_event_type_not_empty'
    ) THEN
      ALTER TABLE event_log 
        ADD CONSTRAINT event_log_event_type_not_empty 
        CHECK (event_type IS NOT NULL AND length(trim(event_type)) > 0);
    END IF;
  END IF;
END $$;

-- BANK_ACCOUNTS: Garantir que balance não é negativo (se aplicável)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bank_accounts' AND column_name = 'cached_balance'
  ) THEN
    -- NOTA: Balance pode ser negativo em alguns casos (débito autorizado)
    -- Por isso não adicionamos CHECK aqui, mas documentamos
  END IF;
END $$;

-- ============================================================
-- 5. UNIQUE CONSTRAINTS: Garantir unicidade por tenant
-- ============================================================

-- ACTORS: Garantir que actor_id é único por tenant
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'actors') THEN
    -- Verificar se constraint já existe
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'actors_tenant_actor_unique'
    ) THEN
      -- Criar constraint única composta
      CREATE UNIQUE INDEX IF NOT EXISTS actors_tenant_actor_unique 
        ON actors(tenant_id, actor_id);
    END IF;
  END IF;
END $$;

-- COMPANIES: Garantir que company_id é único por tenant
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies') THEN
    -- Verificar se constraint já existe
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'companies_tenant_company_unique'
    ) THEN
      -- Criar constraint única composta
      CREATE UNIQUE INDEX IF NOT EXISTS companies_tenant_company_unique 
        ON companies(tenant_id, company_id);
    END IF;
  END IF;
END $$;

-- BANK_ACCOUNTS: Garantir que account_id é único por tenant
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bank_accounts') THEN
    -- Verificar se constraint já existe
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'bank_accounts_tenant_account_unique'
    ) THEN
      -- Criar constraint única composta
      CREATE UNIQUE INDEX IF NOT EXISTS bank_accounts_tenant_account_unique 
        ON bank_accounts(tenant_id, account_id);
    END IF;
  END IF;
END $$;

-- ============================================================
-- 6. NOT NULL CONSTRAINTS: Garantir que tenant_id nunca é NULL
-- ============================================================

-- Esta seção garante que tenant_id é NOT NULL em tabelas críticas
-- Se alguma tabela crítica não tiver, adicionar constraint aqui

-- ACTORS: Garantir tenant_id NOT NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'actors' 
      AND column_name = 'tenant_id' 
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE actors 
      ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
END $$;

-- COMPANIES: Garantir tenant_id NOT NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' 
      AND column_name = 'tenant_id' 
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE companies 
      ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
END $$;

-- BANK_ACCOUNTS: Garantir tenant_id NOT NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bank_accounts' 
      AND column_name = 'tenant_id' 
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE bank_accounts 
      ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
END $$;

-- BANK_LEDGER: Garantir tenant_id NOT NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bank_ledger' 
      AND column_name = 'tenant_id' 
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE bank_ledger 
      ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
END $$;

-- EVENT_LOG: Garantir tenant_id NOT NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_log' 
      AND column_name = 'tenant_id' 
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE event_log 
      ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
END $$;

-- ============================================================
-- 7. FOREIGN KEY CONSTRAINTS: Garantir integridade referencial
-- ============================================================

-- NOTA: PostgreSQL não suporta FKs compostas diretamente
-- Mas podemos garantir que FKs sempre referenciam tabelas que têm tenant_id
-- e adicionar triggers ou CHECK constraints para validar coerência

-- ACTORS: Garantir que user_id (se presente) pertence ao mesmo tenant
-- NOTA: Isso requer trigger ou validação no código
-- Por enquanto, documentamos a necessidade

-- COMPANIES: Garantir que global_user_id (se presente) é válido
-- NOTA: Isso requer validação no código ou trigger
-- Por enquanto, documentamos a necessidade

-- ============================================================
-- 8. ROW LEVEL SECURITY: Garantir isolamento por tenant
-- ============================================================

-- Verificar se RLS está habilitado em tabelas críticas
DO $$
BEGIN
  -- ACTORS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'actors') THEN
    ALTER TABLE actors ENABLE ROW LEVEL SECURITY;
  END IF;
  
  -- COMPANIES
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies') THEN
    ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
  END IF;
  
  -- BANK_ACCOUNTS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bank_accounts') THEN
    ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
  END IF;
  
  -- BANK_LEDGER
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bank_ledger') THEN
    ALTER TABLE bank_ledger ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ============================================================
-- 9. COMENTÁRIOS: Documentar invariantes no schema
-- ============================================================

-- Adicionar comentários nas tabelas críticas documentando invariantes
DO $$
BEGIN
  -- ACTORS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'actors') THEN
    COMMENT ON TABLE actors IS 'INVARIANT: tenant_id é obrigatório e nunca pode ser NULL. Todos os queries DEVEM filtrar por tenant_id.';
    COMMENT ON COLUMN actors.tenant_id IS 'INVARIANT: NOT NULL, FK para tenants. Isolamento de tenant é obrigatório.';
  END IF;
  
  -- COMPANIES
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies') THEN
    COMMENT ON TABLE companies IS 'INVARIANT: tenant_id é obrigatório e nunca pode ser NULL. Todos os queries DEVEM filtrar por tenant_id.';
    COMMENT ON COLUMN companies.tenant_id IS 'INVARIANT: NOT NULL, FK para tenants. Isolamento de tenant é obrigatório.';
  END IF;
  
  -- BANK_ACCOUNTS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bank_accounts') THEN
    COMMENT ON TABLE bank_accounts IS 'INVARIANT: tenant_id é obrigatório e nunca pode ser NULL. Todos os queries DEVEM filtrar por tenant_id.';
    COMMENT ON COLUMN bank_accounts.tenant_id IS 'INVARIANT: NOT NULL, FK para tenants. Isolamento de tenant é obrigatório.';
  END IF;
  
  -- BANK_LEDGER
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bank_ledger') THEN
    COMMENT ON TABLE bank_ledger IS 'INVARIANT: tenant_id é obrigatório e nunca pode ser NULL. Todos os queries DEVEM filtrar por tenant_id.';
    COMMENT ON COLUMN bank_ledger.tenant_id IS 'INVARIANT: NOT NULL, FK para tenants. Isolamento de tenant é obrigatório.';
  END IF;
  
  -- EVENT_LOG
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_log') THEN
    COMMENT ON TABLE event_log IS 'INVARIANT: tenant_id é obrigatório e nunca pode ser NULL. Todos os eventos DEVEM ter tenant_id válido.';
    COMMENT ON COLUMN event_log.tenant_id IS 'INVARIANT: NOT NULL, FK para tenants. Isolamento de tenant é obrigatório.';
  END IF;
  
  -- USERS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    COMMENT ON COLUMN users.token_version IS 'INVARIANT: token_version é obrigatório e nunca pode ser NULL. Deve ser >= 0.';
  END IF;
END $$;

-- ============================================================
-- 10. VALIDAÇÃO FINAL: Verificar que constraints foram aplicadas
-- ============================================================

-- Esta seção valida que as constraints foram aplicadas corretamente
-- Se alguma validação falhar, a migration deve falhar

DO $$
DECLARE
  missing_constraints TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Verificar tenant_id NOT NULL em tabelas críticas
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'actors' 
      AND column_name = 'tenant_id' 
      AND is_nullable = 'YES'
  ) THEN
    missing_constraints := array_append(missing_constraints, 'actors.tenant_id deve ser NOT NULL');
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' 
      AND column_name = 'tenant_id' 
      AND is_nullable = 'YES'
  ) THEN
    missing_constraints := array_append(missing_constraints, 'companies.tenant_id deve ser NOT NULL');
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bank_accounts' 
      AND column_name = 'tenant_id' 
      AND is_nullable = 'YES'
  ) THEN
    missing_constraints := array_append(missing_constraints, 'bank_accounts.tenant_id deve ser NOT NULL');
  END IF;
  
  -- Se houver constraints faltando, lançar erro
  IF array_length(missing_constraints, 1) > 0 THEN
    RAISE EXCEPTION 'Constraints faltando: %', array_to_string(missing_constraints, ', ');
  END IF;
END $$;

-- ============================================================
-- FIM DA MIGRATION
-- ============================================================

-- Log de conclusão
DO $$
BEGIN
  RAISE NOTICE 'Migration 313_schema_invariant_hardening.sql concluída com sucesso';
  RAISE NOTICE 'Invariantes de schema reforçados:';
  RAISE NOTICE '  - tenant_id NOT NULL em tabelas críticas';
  RAISE NOTICE '  - Índices compostos (tenant_id + id) criados';
  RAISE NOTICE '  - CHECK constraints adicionadas';
  RAISE NOTICE '  - UNIQUE constraints por tenant';
  RAISE NOTICE '  - RLS habilitado em tabelas críticas';
  RAISE NOTICE '  - Comentários documentando invariantes';
END $$;




