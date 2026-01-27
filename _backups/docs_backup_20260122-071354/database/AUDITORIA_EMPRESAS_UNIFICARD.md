# 🔍 AUDITORIA COMPLETA — CADASTRO DE EMPRESAS (UNIFICARD)

**Data:** 01/01/2026  
**Escopo:** Fluxo completo de criação de empresas (PJ)  
**Status:** ❌ QUEBRADO

---

## 📊 RESUMO EXECUTIVO

### CAUSA RAIZ DO ERRO
```
DIVERGÊNCIA TOTAL entre TypeScript e PostgreSQL para company_status

Contracts (TypeScript): 'DRAFT' | 'PROVISIONAL' | 'VERIFIED' | 'APPROVED' | 'SUSPENDED'
Banco (PostgreSQL):     'draft' | 'manual' | 'pending_doc' | 'validated'

Backend envia: 'PROVISIONAL' (uppercase)
Banco aceita:  'draft' (lowercase, valor diferente)

Resultado: constraint violation
```

---

## 1️⃣ ARQUITETURA DO BACKEND

### Localização atual: ✅ CORRETA
```
backend/src/core/companies/
├── companies.module.ts      (bootstrap)
├── companies.routes.ts      (endpoints)
├── companies.service.ts     (lógica de negócio)
├── companies.types.ts       (tipos TypeScript)
└── company-validation.service.ts (validação presencial)
```

### Justificativa
- Empresas são **domínio core** (não módulo opcional)
- Localização em `core/` é correta
- **NÃO criar** `modules/company` — seria duplicação

### Referências entre módulos
```
companies.service.ts
  └─ importa actorRepository de @modules/social
  └─ usa pool de @core/database
  └─ valida com @unificard/contracts
```

---

## 2️⃣ FLUXO DE CRIAÇÃO DE EMPRESA

### Diagrama do fluxo atual
```
Frontend: POST /companies
          ↓
          CreateCompanyInput { cnpj, companyName, role, ... }
          ↓
Route:    companies.routes.ts linha 85
          ↓
Service:  companiesService.createCompany(globalUserId, input)
          ↓
          ┌─────────────────────────────────────────────┐
          │ 1. Normaliza CNPJ (remove formatação)       │
          │ 2. Valida formato (14 dígitos)              │
          │ 3. Busca dados Receita Federal (opcional)   │
          │ 4. Define companyStatus = 'PROVISIONAL' ❌  │
          │ 5. INSERT INTO companies (...)              │
          │ 6. INSERT INTO company_users (...)          │
          │ 7. Cria actor (try/catch não bloqueante)    │
          └─────────────────────────────────────────────┘
          ↓
Banco:    ❌ ERRO: company_status 'PROVISIONAL' não existe na constraint
```

### Arquivos envolvidos
| Camada | Arquivo | Linha |
|--------|---------|-------|
| Route | `companies.routes.ts` | 85 |
| Service | `companies.service.ts` | 221 |
| INSERT | `companies.service.ts` | 374-417 |
| Status | `companies.service.ts` | 285 |
| Types | `companies.types.ts` | 18 |
| Contracts | `packages/contracts/src/company.ts` | 18-23 |
| Migration | `migrations/073_company_status_and_documents.sql` | 41-52 |

---

## 3️⃣ COMPANY_STATUS — ANÁLISE CRÍTICA

### Definição no TypeScript (contracts)
**Arquivo:** `packages/contracts/src/company.ts` (linha 18-23)
```typescript
export type CompanyStatus =
  | 'DRAFT'         // Criada, invisível
  | 'PROVISIONAL'   // Ativa socialmente, com limites
  | 'VERIFIED'      // Validada presencialmente
  | 'APPROVED'      // Plena (futuro)
  | 'SUSPENDED';    // Bloqueada
```

### Definição no banco (migration 073)
**Arquivo:** `migrations/073_company_status_and_documents.sql` (linha 41-52)
```sql
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS company_status VARCHAR(20) DEFAULT 'draft';

ALTER TABLE companies
  ADD CONSTRAINT companies_company_status_check
  CHECK (company_status IN ('draft', 'manual', 'pending_doc', 'validated'));
```

### Mapeamento atual (INEXISTENTE)
| TypeScript | PostgreSQL | Status |
|------------|------------|--------|
| DRAFT | draft | ✅ similar (case diferente) |
| PROVISIONAL | ??? | ❌ NÃO EXISTE |
| VERIFIED | validated | ❓ semântica diferente |
| APPROVED | ??? | ❌ NÃO EXISTE |
| SUSPENDED | ??? | ❌ NÃO EXISTE |
| ??? | manual | ❌ NÃO EXISTE no TS |
| ??? | pending_doc | ❌ NÃO EXISTE no TS |

### O que o backend faz hoje
**Arquivo:** `companies.service.ts` (linha 285)
```typescript
// Status inicial: PROVISIONAL (permite uso social com limites)
let companyStatus: CompanyStatus = 'PROVISIONAL';
```

**INSERT (linha 414):**
```typescript
companyStatus, // Passa 'PROVISIONAL' para o banco
```

### RESULTADO
```
❌ ERROR: new row for relation "companies" violates check constraint 
   "companies_company_status_check"
```

---

## 4️⃣ EMPRESA COMO ACTOR

### Código existente
**Arquivo:** `companies.service.ts` (linha 469-480)
```typescript
// 🔴 CRÍTICO: Criar actor do tipo 'page' imediatamente após criar empresa
try {
  const { actorRepository } = await import('@modules/social/actor.repository');
  const tenantId = await this.resolveTenantIdFromGlobalUserId(globalUserId);
  if (tenantId) {
    await actorRepository.findOrCreatePageActor(tenantId, companyId);
  }
} catch (err) {
  // Log mas não bloqueia criação da empresa
  console.warn('[CompaniesService] Erro ao criar actor para empresa (não bloqueante):', err);
}
```

### Análise
| Aspecto | Status | Observação |
|---------|--------|------------|
| Código existe | ✅ | Linhas 469-480 |
| Actor é criado | ⚠️ | Só se não houver erro antes |
| Tipo do actor | ✅ | 'page' (correto) |
| Associação | ✅ | Via company_id |
| Bloqueante | ❌ | Erro é engolido (não ideal) |

### Problema atual
**O código de criação de actor NUNCA É EXECUTADO** porque o INSERT da empresa falha ANTES (constraint violation).

### Método `findOrCreatePageActor`
**Arquivo:** `modules/social/actor.repository.ts`
```typescript
async findOrCreatePageActor(tenantId: string, companyId: string): Promise<ActorRow> {
  // 1. Busca actor existente
  // 2. Se não existe, busca nome da empresa
  // 3. INSERT INTO actors (tenant_id, actor_type, company_id, display_name, slug)
  //    VALUES ($1, 'page', $2, $3, $4)
}
```

---

## 5️⃣ INTEGRAÇÃO COM MÓDULOS DEPENDENTES

### Feed Social
**Arquivo:** `modules/social/actor.repository.ts`
- Depende de actor existente
- Actor é criado após empresa ✅
- **Problema:** Actor não é criado se empresa falha

### Eventos
**Arquivo:** `modules/events/` e `core/events/`
- Eventos podem ser criados por actors do tipo 'page'
- **Problema:** Sem empresa → sem actor → sem eventos

### Seletor de Contexto (Frontend)
**Arquivo:** `frontend/src/contexts/SessionProvider.tsx`
- Chama `GET /social/actors/available`
- Lista actors do usuário (pessoal + empresas)
- **Problema:** Empresa não aparece se actor não foi criado

---

## 6️⃣ CORREÇÃO PROPOSTA

### OPÇÃO A: Alinhar BANCO ao TypeScript (RECOMENDADA)
**Justificativa:**
- O TypeScript já tem semântica clara (DRAFT, PROVISIONAL, VERIFIED, etc.)
- Os valores do banco são confusos (manual? pending_doc?)
- Menos código para alterar

**Migration necessária:**
```sql
-- 104_fix_company_status_values.sql

-- 1. Remover constraint antiga
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_company_status_check;

-- 2. Atualizar valores existentes (mapear old → new)
UPDATE companies SET company_status = 'DRAFT' WHERE company_status = 'draft';
UPDATE companies SET company_status = 'PROVISIONAL' WHERE company_status = 'manual';
UPDATE companies SET company_status = 'PROVISIONAL' WHERE company_status = 'pending_doc';
UPDATE companies SET company_status = 'VERIFIED' WHERE company_status = 'validated';

-- 3. Criar nova constraint com valores do TypeScript
ALTER TABLE companies
ADD CONSTRAINT companies_company_status_check
CHECK (company_status IN ('DRAFT', 'PROVISIONAL', 'VERIFIED', 'APPROVED', 'SUSPENDED'));

-- 4. Atualizar default
ALTER TABLE companies ALTER COLUMN company_status SET DEFAULT 'DRAFT';
```

**Impacto no código:** ZERO (backend já usa valores corretos)

---

### OPÇÃO B: Alinhar TypeScript ao BANCO
**Migration:** Não necessária  
**Alterações necessárias:**

1. **contracts/src/company.ts:**
```typescript
export type CompanyStatus =
  | 'draft'        // Criada, invisível
  | 'manual'       // Preenchido manualmente
  | 'pending_doc'  // Aguardando documentação
  | 'validated';   // Validado
```

2. **companies.service.ts (linha 285):**
```typescript
let companyStatus: CompanyStatus = 'draft';  // era 'PROVISIONAL'
```

3. **Toda lógica de status no service:**
   - Revisar linhas 332-348 (mudanças de status)
   - Revisar qualquer comparação de status

**Problema:** Perde semântica clara do TypeScript

---

## 7️⃣ RECOMENDAÇÃO FINAL

### Fazer agora (mínimo necessário):

1. **Criar migration 104** para alinhar banco ao TypeScript
2. **Testar criação de empresa** — deve passar
3. **Verificar actor criado** — deve aparecer no seletor

### Não fazer agora:
- Refatorar estrutura de pastas
- Mover código entre módulos
- Alterar contracts (já está correto)

---

## 8️⃣ CHECKLIST DE IMPLEMENTAÇÃO

### PASSO 1: Criar migration
```
Arquivo: backend/migrations/104_fix_company_status_values.sql
Conteúdo: ver OPÇÃO A acima
```

### PASSO 2: Aplicar migration
```bash
psql -U usuario -d unificard -f backend/migrations/104_fix_company_status_values.sql
```

### PASSO 3: Testar criação
```bash
curl -X POST http://localhost:3000/companies \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-id: TENANT" \
  -H "Content-Type: application/json" \
  -d '{"cnpj": "12345678000190", "role": "owner"}'
```

### PASSO 4: Verificar actor
```sql
SELECT * FROM actors WHERE actor_type = 'page' ORDER BY created_at DESC LIMIT 5;
```

### PASSO 5: Verificar no frontend
- Fazer login
- Abrir seletor de contexto
- Empresa deve aparecer como opção

---

## 📋 ARQUIVOS MODIFICADOS

| Arquivo | Ação | Motivo |
|---------|------|--------|
| `migrations/104_fix_company_status_values.sql` | CRIAR | Alinhar constraint ao TypeScript |
| `companies.service.ts` | NENHUMA | Já usa valores corretos |
| `contracts/company.ts` | NENHUMA | Já está correto |
| `companies.types.ts` | NENHUMA | Importa de contracts |

---

## 🔒 REGRAS RESPEITADAS

- ✅ Não remover constraint sem justificativa (justificativa: valores incompatíveis)
- ✅ Não ignorar fluxo social (actor é criado junto)
- ✅ Não criar estados inválidos (migração mantém integridade)
- ✅ Priorizar clareza de domínio (empresa ≠ usuário ≠ categoria)
- ✅ Correção mínima (1 migration resolve tudo)

---

*Auditoria concluída. Aguardando aprovação para gerar migration 104.*
