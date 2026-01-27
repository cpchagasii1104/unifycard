# 🔧 DIFFS EXATOS — companies.service.ts

**Arquivo:** `backend/src/core/companies/companies.service.ts`  
**Total de alterações:** 9 linhas

---

## CORREÇÃO 1: Linha 582

### Contexto: Fallback de SELECT (getCompanyById com ownership)

```diff
- companyStatus: (row.company_status || 'draft') as Company['companyStatus'],
+ companyStatus: (row.company_status || 'DRAFT') as Company['companyStatus'],
```

### Buscar no Cursor:
```
(row.company_status || 'draft')
```

---

## CORREÇÃO 2: Linha 663

### Contexto: Fallback de SELECT (getCompanyById sem ownership - test override)

```diff
- companyStatus: (row.company_status || 'draft') as Company['companyStatus'],
+ companyStatus: (row.company_status || 'DRAFT') as Company['companyStatus'],
```

### Buscar no Cursor:
Mesmo padrão, segunda ocorrência.

---

## CORREÇÃO 3: Linha 802

### Contexto: Fallback de SELECT (getCompanyByIdForTenant)

```diff
- companyStatus: (row.company_status || 'draft') as Company['companyStatus'],
+ companyStatus: (row.company_status || 'DRAFT') as Company['companyStatus'],
```

### Buscar no Cursor:
Mesmo padrão, terceira ocorrência.

---

## CORREÇÃO 4: Linha 925

### Contexto: Fallback de SELECT (listCompanies)

```diff
- companyStatus: (row.company_status || 'draft') as Company['companyStatus'],
+ companyStatus: (row.company_status || 'DRAFT') as Company['companyStatus'],
```

### Buscar no Cursor:
Mesmo padrão, quarta ocorrência.

---

## CORREÇÃO 5: Linha 1395 (comentário) + 1399 (código)

### Contexto: UPDATE ao fazer upload de documento

```diff
-     // Atualizar status da empresa para 'pending_doc'
+     // Atualizar status da empresa para 'PROVISIONAL' (aguardando validação)
      const statusUpdate = await pool.query<{ company_status: string }>(
        `
        UPDATE companies
-       SET company_status = 'pending_doc', updated_at = now()
+       SET company_status = 'PROVISIONAL', updated_at = now()
        WHERE company_id = $1::uuid AND global_user_id = $2::uuid
```

### Buscar no Cursor:
```
SET company_status = 'pending_doc'
```

---

## CORREÇÃO 6: Linha 1401

### Contexto: WHERE do UPDATE (não atualizar se já validada)

```diff
        WHERE company_id = $1::uuid AND global_user_id = $2::uuid
-         AND company_status != 'validated'
+         AND company_status != 'VERIFIED'
        RETURNING company_status
```

### Buscar no Cursor:
```
AND company_status != 'validated'
```

---

## CORREÇÃO 7: Linha 1424

### Contexto: Fallback de retorno após upload de documento

```diff
      return {
        documentId: result.rows[0].document_id,
-       companyStatus: updatedCompany?.companyStatus || 'pending_doc',
+       companyStatus: updatedCompany?.companyStatus || 'PROVISIONAL',
      };
```

### Buscar no Cursor:
```
companyStatus: updatedCompany?.companyStatus || 'pending_doc'
```

---

## CORREÇÃO 8: Linha 1626 (comentário) + 1631 (código)

### Contexto: UPDATE ao aprovar documento

```diff
-     // Se aprovado, atualizar status da empresa para 'validated'
+     // Se aprovado, atualizar status da empresa para 'VERIFIED'
      if (status === 'approved') {
        await pool.query(
          `
          UPDATE companies
-         SET company_status = 'validated', is_verified = true, updated_at = now()
+         SET company_status = 'VERIFIED', is_verified = true, updated_at = now()
          WHERE company_id = $1::uuid
```

### Buscar no Cursor:
```
SET company_status = 'validated'
```

---

## CORREÇÃO 9: Linha 1672

### Contexto: Fallback de retorno após atualizar status do documento

```diff
      return {
        documentId,
-       companyStatus: companyResult.rows[0]?.company_status || 'pending_doc',
+       companyStatus: companyResult.rows[0]?.company_status || 'PROVISIONAL',
      };
```

### Buscar no Cursor:
```
companyStatus: companyResult.rows[0]?.company_status || 'pending_doc'
```

---

## 📋 RESUMO PARA BUSCA RÁPIDA NO CURSOR

### Padrão 1: Fallback 'draft' (4 ocorrências)
```
Buscar:    (row.company_status || 'draft')
Substituir: (row.company_status || 'DRAFT')
```

### Padrão 2: pending_doc em SET (1 ocorrência)
```
Buscar:    SET company_status = 'pending_doc'
Substituir: SET company_status = 'PROVISIONAL'
```

### Padrão 3: validated em WHERE (1 ocorrência)
```
Buscar:    AND company_status != 'validated'
Substituir: AND company_status != 'VERIFIED'
```

### Padrão 4: pending_doc em fallback (2 ocorrências)
```
Buscar:    || 'pending_doc'
Substituir: || 'PROVISIONAL'
```

### Padrão 5: validated em SET (1 ocorrência)
```
Buscar:    SET company_status = 'validated'
Substituir: SET company_status = 'VERIFIED'
```

---

## ⚠️ VERIFICAÇÃO PÓS-CORREÇÃO

Após aplicar todas as correções, execute:

```bash
grep -n "pending_doc\|validated\|'draft'" backend/src/core/companies/companies.service.ts
```

**Esperado:** Nenhum resultado (ou apenas comentários antigos)

---

## 🔄 ORDEM DE EXECUÇÃO

1. ✅ Aplicar as 9 correções no `companies.service.ts`
2. ✅ Verificar com grep que não há valores antigos
3. ✅ Reiniciar backend para garantir hot reload
4. ✅ Aplicar migration 104 no banco
5. ✅ Testar criação de empresa

---

*Diffs gerados para execução via Cursor*
