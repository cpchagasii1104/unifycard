# 🔍 AUDITORIA DEFINITIVA — CADASTRO DE EMPRESAS (UNIFICARD)

**Data:** 01/01/2026  
**Escopo:** Fluxo completo de criação de empresas (PJ)  
**Status:** ❌ INCONSISTÊNCIA GRAVE IDENTIFICADA

---

## 📊 RESUMO EXECUTIVO

### PROBLEMA ENCONTRADO

**NÃO É SÓ A CONSTRAINT.** O código está **INTERNAMENTE INCONSISTENTE**.

```
CONTRACTS (fonte de verdade):
  'DRAFT' | 'PROVISIONAL' | 'VERIFIED' | 'APPROVED' | 'SUSPENDED'

BANCO (migration 073):
  'draft' | 'manual' | 'pending_doc' | 'validated'

BACKEND (companies.service.ts):
  - Criação: usa 'PROVISIONAL' (TypeScript) ← linha 285
  - Upload doc: usa 'pending_doc' (banco) ← linha 1399
  - Aprovação doc: usa 'validated' (banco) ← linha 1631
  - Validação: usa 'VERIFIED' (TypeScript) ← linha 1704
```

**O backend usa AMBOS os conjuntos de valores em diferentes partes do código.**

---

## 1️⃣ ARQUITETURA

### Localização atual: ✅ CORRETA

```
backend/src/core/companies/
├── companies.module.ts           (bootstrap)
├── companies.routes.ts           (endpoints)
├── companies.service.ts          (lógica - 1754 linhas)
├── companies.types.ts            (tipos)
└── company-validation.service.ts (validação presencial)
```

### Decisão: NÃO criar `modules/company`

**Justificativa:**
- Empresas são **domínio core** (não feature opcional)
- Está corretamente em `core/` junto com identity, economy, categories
- Criar `modules/company` seria duplicação e inconsistência arquitetural
- O padrão do projeto é: `core/` = infraestrutura obrigatória, `modules/` = features opcionais

---

## 2️⃣ MAPEAMENTO COMPLETO DAS INCONSISTÊNCIAS

### Tabela de ocorrências em `companies.service.ts`:

| Linha | Contexto | Valor usado | Origem |
|-------|----------|-------------|--------|
| 261 | Query anti-fraude | `'PROVISIONAL'` | TypeScript |
| 285 | Variável inicial | `'PROVISIONAL'` | TypeScript |
| 335 | Após busca Receita | `'PROVISIONAL'` | TypeScript |
| 339 | Sem dados Receita | `'PROVISIONAL'` | TypeScript |
| 344 | Erro na busca | `'PROVISIONAL'` | TypeScript |
| 348 | Sem fetch | `'PROVISIONAL'` | TypeScript |
| 582 | Fallback SELECT | `'draft'` | Banco |
| 663 | Fallback SELECT | `'draft'` | Banco |
| 802 | Fallback SELECT | `'draft'` | Banco |
| 925 | Fallback SELECT | `'draft'` | Banco |
| 969 | Comparação bloqueio | `'VERIFIED'`, `'APPROVED'` | TypeScript |
| 1399 | UPDATE upload doc | `'pending_doc'` | Banco |
| 1401 | WHERE upload doc | `'validated'` | Banco |
| 1424 | Fallback retorno | `'pending_doc'` | Banco |
| 1631 | UPDATE aprovação | `'validated'` | Banco |
| 1672 | Fallback retorno | `'pending_doc'` | Banco |
| 1704 | UPDATE validação | `'VERIFIED'` | TypeScript |

### Padrão identificado:

- **Criação inicial:** TypeScript (PROVISIONAL)
- **Fallbacks de SELECT:** Banco (draft)
- **Fluxo de documentos:** Banco (pending_doc, validated)
- **Validação presencial:** TypeScript (VERIFIED)

---

## 3️⃣ EMPRESA COMO ACTOR

### Código existente: ✅ CORRETO (mas nunca executa)

**Arquivo:** `companies.service.ts` (linhas 469-480)

```typescript
// 🔴 CRÍTICO: Criar actor do tipo 'page' imediatamente após criar empresa
try {
  const { actorRepository } = await import('@modules/social/actor.repository');
  const tenantId = await this.resolveTenantIdFromGlobalUserId(globalUserId);
  if (tenantId) {
    await actorRepository.findOrCreatePageActor(tenantId, companyId);
  }
} catch (err) {
  console.warn('[CompaniesService] Erro ao criar actor para empresa (não bloqueante):', err);
}
```

### Problema:
O código de criação de actor **existe e está correto**, mas **nunca é executado** porque o INSERT da empresa falha ANTES (constraint violation).

### Quando a constraint for corrigida:
- Actor será criado automaticamente
- Empresa aparecerá no seletor de contexto
- Feed e eventos funcionarão

---

## 4️⃣ DECISÃO: MIGRATION 104

### ✅ DEVE SER APLICADA (com ajustes)

**Razões:**
1. Contracts (`@unificard/contracts`) é a fonte de verdade documentada
2. Os valores TypeScript têm semântica clara
3. Os valores do banco são confusos (manual? pending_doc?)
4. Backend JÁ usa valores TypeScript em partes críticas

**MAS** a migration 104 sozinha **NÃO RESOLVE** porque o backend continuará enviando valores antigos em algumas queries.

---

## 5️⃣ CORREÇÃO COMPLETA (2 PARTES)

### PARTE 1: Migration (banco)

**Arquivo:** `backend/migrations/104_fix_company_status_values.sql`

A migration deve:
1. Remover constraint antiga
2. Migrar valores existentes:
   - `draft` → `DRAFT`
   - `manual` → `PROVISIONAL`
   - `pending_doc` → `PROVISIONAL` (ou criar novo estado?)
   - `validated` → `VERIFIED`
3. Criar constraint nova com valores TypeScript
4. Atualizar default para `DRAFT`

### PARTE 2: Backend (código)

**Arquivo:** `backend/src/core/companies/companies.service.ts`

Correções necessárias:

| Linha | Atual | Corrigir para |
|-------|-------|---------------|
| 582 | `'draft'` | `'DRAFT'` |
| 663 | `'draft'` | `'DRAFT'` |
| 802 | `'draft'` | `'DRAFT'` |
| 925 | `'draft'` | `'DRAFT'` |
| 1399 | `'pending_doc'` | `'PROVISIONAL'` |
| 1401 | `'validated'` | `'VERIFIED'` |
| 1424 | `'pending_doc'` | `'PROVISIONAL'` |
| 1631 | `'validated'` | `'VERIFIED'` |
| 1672 | `'pending_doc'` | `'PROVISIONAL'` |

---

## 6️⃣ QUESTÃO DE DOMÍNIO: pending_doc

### Problema semântico:

O valor `pending_doc` (aguardando documentação) não tem equivalente direto no TypeScript.

**Opções:**

1. **Mapear para PROVISIONAL** (recomendado)
   - Faz sentido: empresa ainda em validação
   - Simplifica o modelo
   - Não perde funcionalidade

2. **Criar novo valor PENDING_DOC no contracts**
   - Mais preciso semanticamente
   - Requer alterar contracts (breaking change)
   - Requer atualizar frontend

**Recomendação:** Opção 1 (mapear para PROVISIONAL)

O fluxo fica:
```
DRAFT → PROVISIONAL → VERIFIED → APPROVED
         ↑
         Upload de documento mantém em PROVISIONAL
         (não precisa de estado intermediário)
```

---

## 7️⃣ ORDEM DE EXECUÇÃO

### Passo 1: Corrigir backend PRIMEIRO

**Arquivo:** `companies.service.ts`

```typescript
// Linha 582, 663, 802, 925
companyStatus: (row.company_status || 'DRAFT') as Company['companyStatus'],

// Linha 1399
SET company_status = 'PROVISIONAL', updated_at = now()

// Linha 1401
AND company_status != 'VERIFIED'

// Linha 1424
companyStatus: updatedCompany?.companyStatus || 'PROVISIONAL',

// Linha 1631
SET company_status = 'VERIFIED', is_verified = true, updated_at = now()

// Linha 1672
companyStatus: companyResult.rows[0]?.company_status || 'PROVISIONAL',
```

### Passo 2: Aplicar migration

```bash
psql -U usuario -d unificard -f backend/migrations/104_fix_company_status_values.sql
```

### Passo 3: Testar

```bash
# 1. Criar empresa
curl -X POST http://localhost:3000/companies ...

# 2. Verificar no banco
SELECT company_status FROM companies ORDER BY created_at DESC LIMIT 1;
-- Deve retornar: PROVISIONAL

# 3. Verificar actor
SELECT * FROM actors WHERE actor_type = 'page' ORDER BY created_at DESC LIMIT 1;
```

---

## 8️⃣ CHECKLIST FINAL

### Antes de executar:

- [ ] Backup do banco
- [ ] Verificar se há empresas em produção

### Correções no código:

- [ ] Linha 582: `'draft'` → `'DRAFT'`
- [ ] Linha 663: `'draft'` → `'DRAFT'`
- [ ] Linha 802: `'draft'` → `'DRAFT'`
- [ ] Linha 925: `'draft'` → `'DRAFT'`
- [ ] Linha 1399: `'pending_doc'` → `'PROVISIONAL'`
- [ ] Linha 1401: `'validated'` → `'VERIFIED'`
- [ ] Linha 1424: `'pending_doc'` → `'PROVISIONAL'`
- [ ] Linha 1631: `'validated'` → `'VERIFIED'`
- [ ] Linha 1672: `'pending_doc'` → `'PROVISIONAL'`

### Migration:

- [ ] Migration 104 existe e está correta
- [ ] Migration aplicada com sucesso

### Testes:

- [ ] Criar empresa funciona
- [ ] Actor é criado
- [ ] Upload documento funciona
- [ ] Aprovação documento funciona
- [ ] Empresa aparece no seletor de contexto

---

## 📋 ARQUIVOS A MODIFICAR

| Arquivo | Tipo | Ação |
|---------|------|------|
| `companies.service.ts` | Backend | Corrigir 9 linhas |
| `104_fix_company_status_values.sql` | Migration | Verificar/criar |
| `contracts/company.ts` | Contracts | **NÃO ALTERAR** |

---

## ⚠️ ALERTA IMPORTANTE

**NÃO aplicar migration 104 sem corrigir o backend primeiro.**

Se aplicar a migration e não corrigir o código:
- Criação de empresa vai funcionar ✅
- Upload de documento vai quebrar ❌ (vai enviar 'pending_doc' que não existe)
- Aprovação vai quebrar ❌ (vai enviar 'validated' que não existe)

**A correção do backend é PRÉ-REQUISITO da migration.**

---

*Auditoria concluída. Aguardando aprovação para gerar arquivos de correção.*
