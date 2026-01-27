# Schema & DB Invariant Hardening

**Data:** 2025-01-22  
**Status:** ✅ IMPLEMENTADO  
**Migration:** `backend/migrations/313_schema_invariant_hardening.sql`

---

## Objetivo

Garantir que o banco de dados **REJEITA estados inválidos** mesmo com bug no código, reforçando os invariantes canônicos documentados em `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md`.

---

## Invariantes Reforçados no Schema

### 1. tenant_id NOT NULL

**INVARIANTE:** `tenant_id` é obrigatório em todas as tabelas críticas.

**IMPLEMENTAÇÃO:**
- ✅ `ALTER TABLE actors ALTER COLUMN tenant_id SET NOT NULL`
- ✅ `ALTER TABLE companies ALTER COLUMN tenant_id SET NOT NULL`
- ✅ `ALTER TABLE bank_accounts ALTER COLUMN tenant_id SET NOT NULL`
- ✅ `ALTER TABLE bank_ledger ALTER COLUMN tenant_id SET NOT NULL`
- ✅ `ALTER TABLE event_log ALTER COLUMN tenant_id SET NOT NULL`

**RESULTADO:** ✅ Banco rejeita inserções sem `tenant_id`

---

### 2. Foreign Keys com tenant_id

**INVARIANTE:** Foreign keys sempre referenciam tabelas que têm `tenant_id`.

**IMPLEMENTAÇÃO:**
- ✅ `FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE`
- ✅ Todas as tabelas críticas têm FK para `tenants`

**RESULTADO:** ✅ Banco rejeita inserções com `tenant_id` inválido

---

### 3. Índices Compostos (tenant_id + id)

**INVARIANTE:** Queries sempre filtram por `tenant_id` + `id` para performance e segurança.

**IMPLEMENTAÇÃO:**
- ✅ `CREATE INDEX idx_actors_tenant_actor ON actors(tenant_id, actor_id)`
- ✅ `CREATE INDEX idx_companies_tenant_company ON companies(tenant_id, company_id)`
- ✅ `CREATE INDEX idx_bank_accounts_tenant_account ON bank_accounts(tenant_id, account_id)`
- ✅ `CREATE INDEX idx_bank_ledger_tenant_account ON bank_ledger(tenant_id, account_id)`
- ✅ `CREATE INDEX idx_event_log_tenant_event ON event_log(tenant_id, event_id)`

**RESULTADO:** ✅ Performance otimizada e isolamento garantido

---

### 4. CHECK Constraints Defensivas

**INVARIANTE:** Validações defensivas no banco previnem estados inválidos.

**IMPLEMENTAÇÃO:**
- ✅ `CHECK (token_version >= 0)` em `users`
- ✅ `CHECK (event_type IS NOT NULL AND length(trim(event_type)) > 0)` em `event_log`
- ✅ `CHECK (owner_type IN (...))` em `accounts` (já existente)

**RESULTADO:** ✅ Banco rejeita estados inválidos mesmo com bug no código

---

### 5. UNIQUE Constraints por Tenant

**INVARIANTE:** IDs são únicos por tenant (não globalmente).

**IMPLEMENTAÇÃO:**
- ✅ `CREATE UNIQUE INDEX actors_tenant_actor_unique ON actors(tenant_id, actor_id)`
- ✅ `CREATE UNIQUE INDEX companies_tenant_company_unique ON companies(tenant_id, company_id)`
- ✅ `CREATE UNIQUE INDEX bank_accounts_tenant_account_unique ON bank_accounts(tenant_id, account_id)`

**RESULTADO:** ✅ Banco garante unicidade por tenant

---

### 6. Row Level Security (RLS)

**INVARIANTE:** RLS garante isolamento automático por tenant.

**IMPLEMENTAÇÃO:**
- ✅ `ALTER TABLE actors ENABLE ROW LEVEL SECURITY`
- ✅ `ALTER TABLE companies ENABLE ROW LEVEL SECURITY`
- ✅ `ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY`
- ✅ `ALTER TABLE bank_ledger ENABLE ROW LEVEL SECURITY`

**RESULTADO:** ✅ Banco garante isolamento mesmo se código não filtrar

---

### 7. Comentários Documentando Invariantes

**INVARIANTE:** Schema documenta invariantes para desenvolvedores e DBAs.

**IMPLEMENTAÇÃO:**
- ✅ `COMMENT ON TABLE actors IS 'INVARIANT: tenant_id é obrigatório...'`
- ✅ `COMMENT ON COLUMN actors.tenant_id IS 'INVARIANT: NOT NULL, FK para tenants...'`
- ✅ Comentários similares para todas as tabelas críticas

**RESULTADO:** ✅ Documentação inline no schema

---

## Tabelas Críticas Auditadas

### ✅ Tabelas com Proteções Completas

1. **users**
   - ✅ `tenant_id NOT NULL`
   - ✅ `FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)`
   - ✅ `UNIQUE(tenant_id, email)`
   - ✅ `CHECK (token_version >= 0)`
   - ✅ RLS habilitado

2. **profiles**
   - ✅ `tenant_id NOT NULL`
   - ✅ `FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)`
   - ✅ `UNIQUE(tenant_id, user_id)`
   - ✅ RLS habilitado

3. **accounts**
   - ✅ `tenant_id NOT NULL`
   - ✅ `FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)`
   - ✅ `CHECK (owner_type IN (...))`
   - ✅ RLS habilitado

4. **transactions**
   - ✅ `tenant_id NOT NULL`
   - ✅ `FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)`
   - ✅ `CHECK (amount > 0)`
   - ✅ RLS habilitado

5. **ledger**
   - ✅ `tenant_id NOT NULL`
   - ✅ `FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)`
   - ✅ `CHECK (entry_type IN ('credit', 'debit'))`
   - ✅ RLS habilitado

6. **event_log**
   - ✅ `tenant_id NOT NULL`
   - ✅ `FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)`
   - ✅ `CHECK (event_type IS NOT NULL AND length(trim(event_type)) > 0)`
   - ✅ RLS habilitado
   - ✅ Índice composto `(tenant_id, event_id)`

### ✅ Tabelas Reforçadas pela Migration 313

1. **actors**
   - ✅ `tenant_id NOT NULL` (garantido pela migration)
   - ✅ Índice composto `(tenant_id, actor_id)`
   - ✅ UNIQUE constraint `(tenant_id, actor_id)`
   - ✅ RLS habilitado

2. **companies**
   - ✅ `tenant_id NOT NULL` (garantido pela migration)
   - ✅ Índice composto `(tenant_id, company_id)`
   - ✅ UNIQUE constraint `(tenant_id, company_id)`
   - ✅ RLS habilitado

3. **bank_accounts**
   - ✅ `tenant_id NOT NULL` (garantido pela migration)
   - ✅ `FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE`
   - ✅ Índice composto `(tenant_id, account_id)`
   - ✅ UNIQUE constraint `(tenant_id, account_id)`
   - ✅ RLS habilitado

4. **bank_ledger**
   - ✅ `tenant_id NOT NULL` (garantido pela migration)
   - ✅ Índice composto `(tenant_id, account_id)`
   - ✅ Índice composto `(tenant_id, transaction_id)`
   - ✅ RLS habilitado

---

## Validações Implementadas

### 1. Validação de tenant_id NOT NULL

**QUERY DE VALIDAÇÃO:**
```sql
SELECT table_name, column_name, is_nullable
FROM information_schema.columns
WHERE table_name IN ('actors', 'companies', 'bank_accounts', 'bank_ledger', 'event_log')
  AND column_name = 'tenant_id'
  AND is_nullable = 'YES';
```

**RESULTADO ESPERADO:** 0 linhas (todas as tabelas têm `tenant_id NOT NULL`)

---

### 2. Validação de Índices Compostos

**QUERY DE VALIDAÇÃO:**
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('actors', 'companies', 'bank_accounts', 'bank_ledger', 'event_log')
  AND indexdef LIKE '%tenant_id%';
```

**RESULTADO ESPERADO:** Índices compostos presentes

---

### 3. Validação de CHECK Constraints

**QUERY DE VALIDAÇÃO:**
```sql
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid IN (
  SELECT oid FROM pg_class WHERE relname IN ('users', 'event_log', 'accounts')
)
AND contype = 'c';
```

**RESULTADO ESPERADO:** CHECK constraints presentes

---

### 4. Validação de RLS

**QUERY DE VALIDAÇÃO:**
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('actors', 'companies', 'bank_accounts', 'bank_ledger', 'event_log');
```

**RESULTADO ESPERADO:** `rowsecurity = true` para todas as tabelas

---

## Como Executar a Migration

### Executar migration:
```bash
cd backend
pnpm migrate
```

### Verificar se constraints foram aplicadas:
```sql
-- Verificar tenant_id NOT NULL
SELECT table_name, column_name, is_nullable
FROM information_schema.columns
WHERE table_name IN ('actors', 'companies', 'bank_accounts', 'bank_ledger', 'event_log')
  AND column_name = 'tenant_id';

-- Verificar índices compostos
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('actors', 'companies', 'bank_accounts', 'bank_ledger', 'event_log')
  AND indexdef LIKE '%tenant_id%';

-- Verificar CHECK constraints
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid IN (
  SELECT oid FROM pg_class WHERE relname IN ('users', 'event_log', 'accounts')
)
AND contype = 'c';
```

---

## Critérios de Sucesso

### ✅ tenant_id NOT NULL
- [x] `actors.tenant_id` → NOT NULL
- [x] `companies.tenant_id` → NOT NULL
- [x] `bank_accounts.tenant_id` → NOT NULL
- [x] `bank_ledger.tenant_id` → NOT NULL
- [x] `event_log.tenant_id` → NOT NULL

### ✅ Foreign Keys com tenant_id
- [x] Todas as tabelas críticas têm FK para `tenants(tenant_id)`
- [x] `ON DELETE CASCADE` onde apropriado

### ✅ Índices Compostos
- [x] `idx_actors_tenant_actor` → `(tenant_id, actor_id)`
- [x] `idx_companies_tenant_company` → `(tenant_id, company_id)`
- [x] `idx_bank_accounts_tenant_account` → `(tenant_id, account_id)`
- [x] `idx_bank_ledger_tenant_account` → `(tenant_id, account_id)`
- [x] `idx_event_log_tenant_event` → `(tenant_id, event_id)`

### ✅ CHECK Constraints
- [x] `users.token_version >= 0`
- [x] `event_log.event_type NOT NULL AND length(trim(event_type)) > 0`
- [x] `accounts.owner_type IN (...)`

### ✅ UNIQUE Constraints por Tenant
- [x] `actors(tenant_id, actor_id)` → UNIQUE
- [x] `companies(tenant_id, company_id)` → UNIQUE
- [x] `bank_accounts(tenant_id, account_id)` → UNIQUE

### ✅ Row Level Security
- [x] RLS habilitado em `actors`
- [x] RLS habilitado em `companies`
- [x] RLS habilitado em `bank_accounts`
- [x] RLS habilitado em `bank_ledger`
- [x] RLS habilitado em `event_log`

---

## Resultado

**✅ BANCO DE DADOS BLINDADO CONTRA ESTADOS INVÁLIDOS**

O banco de dados agora **REJEITA estados inválidos** mesmo com bug no código:

- ✅ `tenant_id` nunca pode ser NULL (constraint no banco)
- ✅ `tenant_id` inválido rejeitado (FK constraint)
- ✅ Queries sem filtro de `tenant_id` são lentas (falta de índice)
- ✅ Estados inválidos rejeitados (CHECK constraints)
- ✅ Isolamento garantido (RLS habilitado)

**Status Final:** ✅ **SCHEMA HARDENED - BANCO REJEITA ESTADOS INVÁLIDOS**

---

**Última Revisão:** 2025-01-22  
**Próxima Revisão:** Conforme evolução do schema


