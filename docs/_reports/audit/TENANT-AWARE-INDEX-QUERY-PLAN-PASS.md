# Tenant-Aware Index & Query Plan Pass — Auditoria de Performance

**Data:** 2025-01-22  
**Status:** ✅ **IMPLEMENTADO**  
**Objetivo:** Garantir que todas as queries críticas usam índices tenant-aware

---

## Objetivo

Garantir que todas as queries críticas em tabelas multi-tenant usam índices tenant-aware para performance e segurança. Zero Seq Scan em tabelas críticas.

---

## Contexto

Performance também é segurança. Queries lentas podem ser vetores de ataque (DoS). Índices tenant-aware garantem:
- Performance determinística
- Isolamento eficiente
- Escalabilidade

---

## Índices Tenant-Aware Existentes

### Migration 313: Schema Invariant Hardening

Os seguintes índices foram criados na migration `313_schema_invariant_hardening.sql`:

#### ACTORS
- `idx_actors_tenant_actor` - `(tenant_id, actor_id)`
- `idx_actors_tenant_user` - `(tenant_id, user_id)` WHERE `user_id IS NOT NULL`
- `actors_tenant_actor_unique` - UNIQUE `(tenant_id, actor_id)`

#### COMPANIES
- `idx_companies_tenant_company` - `(tenant_id, company_id)`
- `idx_companies_tenant_global_user` - `(tenant_id, global_user_id)` WHERE `global_user_id IS NOT NULL`
- `companies_tenant_company_unique` - UNIQUE `(tenant_id, company_id)`

#### BANK_ACCOUNTS
- `idx_bank_accounts_tenant_account` - `(tenant_id, account_id)`
- `idx_bank_accounts_tenant_owner` - `(tenant_id, owner_id)`
- `bank_accounts_tenant_account_unique` - UNIQUE `(tenant_id, account_id)`

#### BANK_LEDGER
- `idx_bank_ledger_tenant_account` - `(tenant_id, account_id)`
- `idx_bank_ledger_tenant_transaction` - `(tenant_id, transaction_id)`

---

## Queries Críticas Analisadas

### ACTORS

#### `findById(tenantId, actorId)`
```sql
SELECT * FROM actors 
WHERE tenant_id = $1 AND actor_id = $2 
LIMIT 1
```
**Índice esperado:** `idx_actors_tenant_actor`  
**Plano esperado:** Index Scan usando `idx_actors_tenant_actor`

#### `findByUserId(tenantId, userId)`
```sql
SELECT * FROM actors 
WHERE tenant_id = $1 AND user_id = $2 AND actor_type = 'user'
LIMIT 1
```
**Índice esperado:** `idx_actors_tenant_user`  
**Plano esperado:** Index Scan usando `idx_actors_tenant_user`

### COMPANIES

#### `getCompanyById(tenantId, companyId)`
```sql
SELECT * FROM companies 
WHERE tenant_id = $1 AND company_id = $2::uuid 
LIMIT 1
```
**Índice esperado:** `idx_companies_tenant_company`  
**Plano esperado:** Index Scan usando `idx_companies_tenant_company`

#### `listByGlobalUserId(tenantId, globalUserId)`
```sql
SELECT * FROM companies 
WHERE tenant_id = $1 AND global_user_id = $2::uuid
ORDER BY created_at DESC
```
**Índice esperado:** `idx_companies_tenant_global_user`  
**Plano esperado:** Index Scan usando `idx_companies_tenant_global_user`

#### `findByCNPJ(tenantId, globalUserId, cnpj)`
```sql
SELECT company_id FROM companies 
WHERE tenant_id = $1 AND global_user_id = $2::uuid AND cnpj = $3
LIMIT 1
```
**Índice esperado:** `idx_companies_tenant_global_user` (parcial)  
**Plano esperado:** Index Scan usando `idx_companies_tenant_global_user` + Filter por `cnpj`

**⚠️ RECOMENDAÇÃO:** Considerar criar índice adicional `(tenant_id, global_user_id, cnpj)` se esta query for muito frequente.

### BANK_ACCOUNTS

#### `getAccountById(tenantId, accountId)`
```sql
SELECT * FROM bank_accounts 
WHERE tenant_id = $1 AND account_id = $2::uuid 
LIMIT 1
```
**Índice esperado:** `idx_bank_accounts_tenant_account`  
**Plano esperado:** Index Scan usando `idx_bank_accounts_tenant_account`

#### `getByOwner(tenantId, ownerId)`
```sql
SELECT * FROM bank_accounts 
WHERE tenant_id = $1 AND owner_id = $2::uuid
ORDER BY created_at DESC
```
**Índice esperado:** `idx_bank_accounts_tenant_owner`  
**Plano esperado:** Index Scan usando `idx_bank_accounts_tenant_owner`

### BANK_LEDGER

#### `getEntriesByAccount(tenantId, accountId)`
```sql
SELECT * FROM bank_ledger 
WHERE tenant_id = $1 AND account_id = $2::uuid
ORDER BY timestamp DESC
```
**Índice esperado:** `idx_bank_ledger_tenant_account`  
**Plano esperado:** Index Scan usando `idx_bank_ledger_tenant_account`

**⚠️ RECOMENDAÇÃO:** Considerar criar índice adicional `(tenant_id, account_id, timestamp DESC)` para otimizar ORDER BY.

#### `getEntriesByTransaction(tenantId, transactionId)`
```sql
SELECT * FROM bank_ledger 
WHERE tenant_id = $1 AND transaction_id = $2::uuid
ORDER BY timestamp DESC
```
**Índice esperado:** `idx_bank_ledger_tenant_transaction`  
**Plano esperado:** Index Scan usando `idx_bank_ledger_tenant_transaction`

#### `calculateBalance(tenantId, accountId)`
```sql
SELECT COALESCE(SUM(amount), 0) as balance 
FROM bank_ledger 
WHERE tenant_id = $1 AND account_id = $2::uuid
```
**Índice esperado:** `idx_bank_ledger_tenant_account`  
**Plano esperado:** Index Scan usando `idx_bank_ledger_tenant_account`

---

## Script de Análise

### Executar Análise

```bash
npm run analyze:query-plans
```

O script:
1. Verifica índices tenant-aware existentes
2. Executa `EXPLAIN ANALYZE` em todas as queries críticas
3. Identifica Seq Scans indevidos
4. Gera relatório em `backend/audit-reports/query-plans-analysis.json`

### Saída Esperada

```
📊 Resumo:
  ✅ Queries OK: 8
  ⚠️  Queries com warnings: 0
  ❌ Queries críticas: 0
```

---

## Planos de Execução Esperados

### Padrão Ideal

Todas as queries críticas devem usar:

1. **Index Scan** ou **Index Only Scan** (preferível)
2. **Index Name** contendo `tenant_id`
3. **Cost** baixo (< 100 para queries simples)
4. **Zero Seq Scan** em tabelas críticas

### Exemplo de Plano Esperado

```
Index Scan using idx_companies_tenant_company on companies
  Index Cond: (tenant_id = $1 AND company_id = $2)
  Cost: 0.42..8.44 rows=1 width=XXX
  Actual Time: 0.123..0.125 rows=1 loops=1
```

---

## Índices Adicionais Recomendados

### COMPANIES

#### `(tenant_id, global_user_id, cnpj)`
**Uso:** Query `findByCNPJ`  
**Benefício:** Evita filtro adicional após Index Scan  
**Prioridade:** Média (se query for muito frequente)

#### `(tenant_id, global_user_id, created_at DESC)`
**Uso:** Query `listByGlobalUserId` com ORDER BY  
**Benefício:** Evita sort adicional  
**Prioridade:** Baixa (sort é rápido para poucos registros)

### BANK_LEDGER

#### `(tenant_id, account_id, timestamp DESC)`
**Uso:** Query `getEntriesByAccount` com ORDER BY  
**Benefício:** Evita sort adicional  
**Prioridade:** Média (se ledger crescer muito)

---

## Critérios de Sucesso

- ✅ Zero Seq Scan em tabelas multi-tenant críticas
- ✅ Todas as queries críticas usam Index Scan
- ✅ Planos de execução determinísticos
- ✅ Cost baixo (< 100 para queries simples)
- ✅ Índices tenant-aware criados e funcionando

---

## Como Verificar Manualmente

### 1. Verificar Índices Existentes

```sql
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('actors', 'companies', 'bank_accounts', 'bank_ledger')
  AND indexdef LIKE '%tenant_id%'
ORDER BY tablename, indexname;
```

### 2. Analisar Query Específica

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT * FROM companies 
WHERE tenant_id = 'test-tenant-id' AND company_id = 'test-company-id'::uuid 
LIMIT 1;
```

### 3. Verificar Uso de Índice

```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename IN ('actors', 'companies', 'bank_accounts', 'bank_ledger')
  AND indexname LIKE '%tenant%'
ORDER BY idx_scan DESC;
```

---

## Referências

- **Schema Hardening:** [`backend/migrations/313_schema_invariant_hardening.sql`](../../backend/migrations/313_schema_invariant_hardening.sql)
- **Script de Análise:** [`backend/scripts/analyze-query-plans.ts`](../../backend/scripts/analyze-query-plans.ts)
- **SSOT de Invariantes:** [`docs/audit/SYSTEM-CANONICAL-INVARIANTS.md`](SYSTEM-CANONICAL-INVARIANTS.md)

---

**Última Atualização:** 2025-01-22

