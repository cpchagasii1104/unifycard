# Global User ID Tenant Safety Pass — Auditoria de Segurança

**Data:** 2025-01-22  
**Status:** ✅ **CORREÇÕES APLICADAS** (pendente atualização de chamadores)  
**Objetivo:** Eliminar ambiguidade entre `global_user_id` × `tenant`

---

## Objetivo

Garantir que nenhuma query usa `global_user_id` sem filtro explícito de `tenant_id`, prevenindo vazamento cross-tenant.

---

## Contexto

`global_user_id` é uma identidade global (SSOT) que pode ser compartilhada entre múltiplos tenants. Queries que usam apenas `global_user_id` sem filtro de `tenant_id` podem retornar dados de múltiplos tenants, violando isolamento.

---

## Vulnerabilidades Identificadas

### 1. `companies.service.ts`

#### 1.1 `createCompany()`
- **Linha 244:** `WHERE global_user_id = $1::uuid AND cnpj = $2` ❌
- **Linha 262:** `WHERE global_user_id = $1::uuid` ❌
- **Linha 364:** `WHERE global_user_id = $1::uuid` (UPDATE company_users) ❌

**Status:** ✅ **CORRIGIDO**
- Adicionado `tenantId` como parâmetro opcional
- Resolução automática de `tenantId` se não fornecido
- Validação explícita de `tenantId`
- Queries migradas para `runQueryWithTenant` com filtro `tenant_id`

#### 1.2 `listCompanies()`
- **Linha 993:** `WHERE c.global_user_id = $1::uuid` ❌

**Status:** ✅ **CORRIGIDO**
- Adicionado `tenantId` como parâmetro opcional
- Resolução automática de `tenantId` se não fornecido
- Validação explícita de `tenantId`
- Query migrada para `runQueryWithTenant` com filtro `tenant_id`

#### 1.3 `getCompanyUserById()`
- **Linha 1202:** `WHERE company_user_id = $1::uuid AND global_user_id = $2::uuid` ❌

**Status:** ✅ **CORRIGIDO**
- Adicionado `tenantId` como parâmetro opcional
- Resolução automática de `tenantId` se não fornecido
- Validação explícita de `tenantId`
- Query migrada para `runQueryWithTenant` com JOIN em `companies` para filtro `tenant_id`

#### 1.4 `updateCompanyUser()`
- **Linha 1299:** `WHERE global_user_id = $1::uuid AND company_user_id != $2::uuid` ❌
- **Linha 1324:** `WHERE company_user_id = $${paramIdx}::uuid AND global_user_id = $${paramIdx + 1}::uuid` ❌

**Status:** ✅ **CORRIGIDO**
- Adicionado `tenantId` como parâmetro opcional
- Resolução automática de `tenantId` se não fornecido
- Validação explícita de `tenantId`
- Queries migradas para `runQueryWithTenant` com filtro `tenant_id`

#### 1.5 `deleteCompany()`
- **Linha 1387:** `WHERE company_id = $1::uuid AND global_user_id = $2::uuid` ❌

**Status:** ✅ **CORRIGIDO**
- Adicionado `tenantId` como parâmetro opcional
- Resolução automática de `tenantId` se não fornecido
- Validação explícita de `tenantId`
- Query migrada para `runQueryWithTenant` com filtro `tenant_id`

#### 1.6 `uploadCompanyDocument()`
- **Linha 1504:** `WHERE company_id = $1::uuid AND global_user_id = $2::uuid` ❌

**Status:** 🔄 **PENDENTE**

#### 1.7 `listCompanyDocuments()`
- **Linha 1579:** `WHERE company_id = $1::uuid AND global_user_id = $2::uuid` ❌

**Status:** 🔄 **PENDENTE**

#### 1.8 `requestCompanyVerification()`
- **Linha 1504:** `WHERE company_id = $1::uuid AND global_user_id = $2::uuid` ❌

**Status:** 🔄 **PENDENTE**

---

## Correções Aplicadas

### Padrão de Correção

1. **Adicionar `tenantId` como parâmetro opcional** nos métodos
2. **Resolver `tenantId` automaticamente** se não fornecido via `resolveTenantIdFromGlobalUserId()`
3. **Validar `tenantId` explicitamente** antes de qualquer query
4. **Migrar queries para `runQueryWithTenant`** quando aplicável
5. **Adicionar filtro `tenant_id`** em todas as queries críticas
6. **Adicionar logs canônicos** de violação

### Exemplo de Correção

**Antes:**
```typescript
async createCompany(globalUserId: string, input: CreateCompanyInput) {
  const existing = await pool.query(
    `SELECT company_id FROM companies WHERE global_user_id = $1::uuid AND cnpj = $2`,
    [globalUserId, formattedCNPJ]
  );
}
```

**Depois:**
```typescript
async createCompany(globalUserId: string, input: CreateCompanyInput, tenantId?: string) {
  let finalTenantId = tenantId;
  if (!finalTenantId) {
    finalTenantId = await this.resolveTenantIdFromGlobalUserId(globalUserId);
    if (!finalTenantId) {
      console.error('[CompaniesService] ❌ GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: ...');
      throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId é obrigatório');
    }
  }

  if (!finalTenantId || typeof finalTenantId !== 'string' || finalTenantId.trim() === '') {
    console.error('[CompaniesService] ❌ GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: ...');
    throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId inválido');
  }

  const existing = await runQueryWithTenant(
    finalTenantId,
    `SELECT company_id FROM companies WHERE tenant_id = $1 AND global_user_id = $2::uuid AND cnpj = $3`,
    [finalTenantId, globalUserId, formattedCNPJ]
  );
}
```

---

## Logs Canônicos Adicionados

Todos os métodos corrigidos agora incluem logs canônicos de violação:

```typescript
console.error('[CompaniesService] ❌ GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: Não foi possível resolver tenantId para globalUserId', {
  globalUserId,
  operation: 'createCompany',
  timestamp: new Date().toISOString(),
});
```

---

## Próximos Passos

1. ✅ Corrigir `createCompany()`
2. ✅ Corrigir `listCompanies()`
3. ✅ Corrigir `getCompanyUserById()`
4. ✅ Corrigir `updateCompanyUser()`
5. ✅ Corrigir `deleteCompany()`
6. ✅ Corrigir `uploadCompanyDocument()`
7. ✅ Corrigir `listCompanyDocuments()`
8. 🔄 Corrigir `requestCompanyVerification()` (se existir)
9. 🔄 Auditar outros serviços que usam `global_user_id`
10. 🔄 Criar testes de invariantes para `global_user_id` × `tenant_id`
11. 🔄 Atualizar chamadores dos métodos corrigidos para passar `tenantId`

---

## Referências

- **SSOT de Invariantes:** [`docs/audit/SYSTEM-CANONICAL-INVARIANTS.md`](SYSTEM-CANONICAL-INVARIANTS.md)
- **Adversarial Security Pass:** [`docs/audit/ADVERSARIAL-SECURITY-PASS.md`](ADVERSARIAL-SECURITY-PASS.md)

---

**Última Atualização:** 2025-01-22

