# 🎯 CHECKLIST CURSOR — CORREÇÃO CADASTRO DE EMPRESAS

**Objetivo:** Corrigir divergência company_status entre TypeScript e PostgreSQL

---

## 🔴 DIAGNÓSTICO CONFIRMADO

```
PROBLEMA:
Backend envia:  'PROVISIONAL' (uppercase)
Banco aceita:   'draft', 'manual', 'pending_doc', 'validated' (lowercase, valores diferentes)

RESULTADO: constraint violation ao criar empresa
```

---

## ✅ PASSO 1: Aplicar migration 104

### No Cursor (terminal):
```bash
cd backend/migrations
```

### Criar arquivo:
```
Nome: 104_fix_company_status_values.sql
Conteúdo: copiar do arquivo gerado
```

### Ou copiar via terminal:
```bash
cp /path/to/104_fix_company_status_values.sql backend/migrations/
```

### Executar no banco:
```bash
psql -U usuario -d unificard -f backend/migrations/104_fix_company_status_values.sql
```

### ✅ Critério de aceite:
```
========================================
✅ MIGRATION 104 CONCLUÍDA COM SUCESSO
========================================
```

---

## ✅ PASSO 2: Verificar constraint

### No banco:
```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'companies'::regclass
  AND conname = 'companies_company_status_check';
```

### ✅ Esperado:
```
companies_company_status_check | CHECK ((company_status)::text = ANY (ARRAY['DRAFT'::text, 'PROVISIONAL'::text, 'VERIFIED'::text, 'APPROVED'::text, 'SUSPENDED'::text]))
```

---

## ✅ PASSO 3: Testar criação de empresa

### Via cURL:
```bash
curl -X POST http://localhost:3000/companies \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "x-tenant-id: SEU_TENANT" \
  -H "Content-Type: application/json" \
  -d '{
    "cnpj": "12345678000199",
    "companyName": "Empresa Teste LTDA",
    "role": "owner"
  }'
```

### ✅ Esperado:
```json
{
  "company": {
    "companyId": "uuid...",
    "companyStatus": "PROVISIONAL",
    ...
  },
  "companyUser": { ... }
}
```

### ❌ Se der erro:
- Verificar se migration foi aplicada
- Verificar logs do backend

---

## ✅ PASSO 4: Verificar actor criado

### No banco:
```sql
SELECT actor_id, tenant_id, actor_type, company_id, display_name
FROM actors
WHERE actor_type = 'page'
ORDER BY created_at DESC
LIMIT 5;
```

### ✅ Esperado:
- Actor com `company_id` da empresa criada
- `actor_type = 'page'`
- `display_name` com nome da empresa

### ❌ Se actor não existir:
- Verificar logs do backend (linha 479 do companies.service.ts)
- Verificar se `tenantId` está sendo resolvido

---

## ✅ PASSO 5: Verificar no frontend

1. Fazer login no frontend
2. Clicar no seletor de contexto (canto superior)
3. Empresa deve aparecer como opção

### ✅ Esperado:
- Empresa aparece na lista
- Pode alternar para postar como empresa

### ❌ Se não aparecer:
```sql
-- Verificar actors disponíveis para o usuário
SELECT a.*
FROM actors a
INNER JOIN company_users cu ON a.company_id = cu.company_id
INNER JOIN global_users gu ON cu.global_user_id = gu.global_user_id
WHERE gu.global_user_id = 'SEU_GLOBAL_USER_ID'
  AND a.actor_type = 'page';
```

---

## ✅ PASSO 6: Teste de regressão

### Checklist:
- [ ] Criar empresa com CNPJ formatado (12.345.678/0001-99)
- [ ] Criar empresa com CNPJ sem formatação (12345678000199)
- [ ] Empresa aparece no seletor de contexto
- [ ] Pode criar post como empresa
- [ ] Empresa aparece em /companies (listagem)

---

## 📋 RESUMO DAS ALTERAÇÕES

| Arquivo | Ação | Status |
|---------|------|--------|
| `migrations/104_fix_company_status_values.sql` | CRIAR | 🆕 |
| `companies.service.ts` | NENHUMA | ✅ |
| `contracts/company.ts` | NENHUMA | ✅ |
| `companies.types.ts` | NENHUMA | ✅ |

---

## 🔒 REGRA FINAL

```
Após migration 104:

Banco aceita: DRAFT, PROVISIONAL, VERIFIED, APPROVED, SUSPENDED
Backend envia: PROVISIONAL (correto!)
Constraint: ✅ alinhada com TypeScript

Empresa criada → Actor criado → Feed funciona → Eventos funcionam
```

---

*Execute PASSO a PASSO. Não pule etapas.*
