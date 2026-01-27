# 🔧 CORREÇÃO: Validação Presencial de Empresas

**Problemas identificados:** 2  
**Status:** Bloqueando fluxo de validação

---

## PROBLEMA 1: Body vazio no POST (Frontend)

### Causa
O `apiFetch` sempre envia `Content-Type: application/json`, mas a chamada `requestCompanyValidation` não envia body.

### Arquivo
`frontend/src/api/companies.ts`

### Linha 289-294

```diff
export async function requestCompanyValidation(companyId: string): Promise<ValidationRequest> {
  const response = await apiFetch(`/companies/${companyId}/request-validation`, {
    method: 'POST',
+   body: JSON.stringify({}),
  });
  return response.json();
}
```

---

## PROBLEMA 2: tenant_id não existe na tabela companies (Backend)

### Causa
O `company-validation.service.ts` usa `runQueryWithTenant` que adiciona filtro `tenant_id`, mas a tabela `companies` não tem essa coluna.

### Arquivo
`backend/src/core/companies/company-validation.service.ts`

### CORREÇÃO 2.1: Linha 6 - Importar pool

```diff
- import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
+ import { pool, runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
```

### CORREÇÃO 2.2: Linhas 60-72 - requestValidation (SELECT company)

```diff
    // Verificar se empresa existe e está PROVISIONAL
-   const company = await runQueryWithTenant<{
-     company_id: string;
-     company_status: string;
-   }>(
-     tenantId,
-     `
-     SELECT company_id, company_status
-     FROM companies
-     WHERE company_id = $1 AND tenant_id = $2
-     LIMIT 1
-     `,
-     [companyId, tenantId]
-   );
+   const companyResult = await pool.query<{
+     company_id: string;
+     company_status: string;
+   }>(
+     `
+     SELECT company_id, company_status
+     FROM companies
+     WHERE company_id = $1
+     LIMIT 1
+     `,
+     [companyId]
+   );
+   const company = companyResult.rows;
```

### CORREÇÃO 2.3: Linhas 167-179 - validateInPerson (SELECT company)

```diff
    // 5. Verificar se empresa ainda está PROVISIONAL
-   const company = await runQueryWithTenant<{
-     company_id: string;
-     company_status: string;
-   }>(
-     tenantId,
-     `
-     SELECT company_id, company_status
-     FROM companies
-     WHERE company_id = $1 AND tenant_id = $2
-     LIMIT 1
-     `,
-     [input.company_id, tenantId]
-   );
+   const companyResult2 = await pool.query<{
+     company_id: string;
+     company_status: string;
+   }>(
+     `
+     SELECT company_id, company_status
+     FROM companies
+     WHERE company_id = $1
+     LIMIT 1
+     `,
+     [input.company_id]
+   );
+   const company = companyResult2.rows;
```

### CORREÇÃO 2.4: Linhas 259-268 - validateInPerson (UPDATE companies)

```diff
      // Atualizar status da empresa
      {
        query: `
          UPDATE companies
          SET company_status = 'VERIFIED',
              verified_at = $1,
              updated_at = NOW()
-         WHERE company_id = $2 AND tenant_id = $3
+         WHERE company_id = $2
        `,
-       params: [validatedAt, input.company_id, tenantId],
+       params: [validatedAt, input.company_id],
      },
```

---

## 📋 RESUMO DAS ALTERAÇÕES

| Arquivo | Tipo | Correção |
|---------|------|----------|
| `frontend/src/api/companies.ts` | Frontend | Adicionar `body: JSON.stringify({})` |
| `backend/src/core/companies/company-validation.service.ts` | Backend | Usar `pool.query` para companies (sem tenant_id) |

---

## ⚠️ NOTA IMPORTANTE

A tabela `companies` não tem `tenant_id` por design — empresas são vinculadas a `global_user_id`, que é multi-tenant naturalmente.

As tabelas que SIM têm `tenant_id`:
- `company_validations` ✅
- `partner_employees` ✅
- `actors` ✅

A tabela `companies` NÃO tem:
- `companies` ❌ (usa `global_user_id` como referência)

---

## 🔄 ORDEM DE EXECUÇÃO

1. Aplicar correção no frontend (`companies.ts`)
2. Aplicar correções no backend (`company-validation.service.ts`)
3. Reiniciar backend
4. Testar "Validar presencialmente" no modal

---

*Correções prontas para execução via Cursor*
