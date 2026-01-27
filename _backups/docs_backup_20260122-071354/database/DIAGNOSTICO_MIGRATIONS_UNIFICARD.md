# 🔍 DIAGNÓSTICO CONSOLIDADO — AUDITORIA DE MIGRATIONS UNIFICARD

**Data:** 01/01/2026  
**Objetivo:** Identificar contratos quebrados entre migrations ↔ backend ↔ frontend  
**Destinatário:** Clayton / Cursor

---

## 📋 RESUMO EXECUTIVO

### Problemas Identificados

| # | Problema | Causa Raiz | Severidade |
|---|----------|------------|------------|
| 1 | Categorias não carregam (árvore vazia) | **Status não é `active` ou `auto_active`** nas categorias OU **seeds nunca executados** | 🔴 CRÍTICO |
| 2 | Erro ao criar empresa (CNPJ) | **Constraint duplicada** (`companies_cnpj_format` vs `companies_cnpj_digits_only`) | 🔴 CRÍTICO |
| 3 | Migrations duplicadas | Dois arquivos `100_*.sql` causando ordem de execução indeterminada | 🟡 MÉDIO |
| 4 | Autocomplete sumiu | **Cascata do problema #1** — sem categorias = sem autocomplete | 🔴 CRÍTICO |
| 5 | Botão "adicionar evento" sumiu | **activeActor null** — não depende de categorias, mas de actors | 🟡 MÉDIO |

---

## 🔴 PROBLEMA 1: CATEGORIAS NÃO CARREGAM

### Diagnóstico

**Fluxo do Problema:**
```
Frontend GET /categories/tree
    ↓
Backend categoriesService.getCategoryTree()
    ↓
Repository.findAll() com filtro: (status IN ('active', 'auto_active') OR status IS NULL)
    ↓
Banco retorna ZERO rows
    ↓
Frontend recebe { ok: true, data: [] }
```

### Causa Raiz Identificada

O repositório `categories.repository.ts` (linha 18-26) tem lógica correta:
```typescript
private async getStatusCondition(): Promise<string> {
  const hasStatus = await this.hasStatusColumn();
  if (!hasStatus) return '1=1';
  return '(status IN (\'active\', \'auto_active\') OR status IS NULL)';
}
```

**O problema é um dos seguintes:**

1. **Seeds nunca foram executados** — a tabela `categories` está VAZIA
2. **Seeds foram executados ANTES da migration 055** — categorias não têm o campo `status`
3. **Seeds foram executados sem `allowActive: true`** — categorias foram criadas como `pending`

### Como Verificar no Banco

```sql
-- 1. Verificar se existem categorias
SELECT COUNT(*) FROM categories;

-- 2. Se existem, verificar status
SELECT status, COUNT(*) FROM categories GROUP BY status;

-- 3. Se todas são pending, verificar por que
SELECT category_id, name, status, created_by_ai FROM categories LIMIT 10;
```

### Correção

**Cenário A: Tabela vazia**
```bash
# Executar seeds
cd backend
npx ts-node src/scripts/seed-professional-categories.ts
npx ts-node src/scripts/seed-physical-categories.ts
npx ts-node src/scripts/seed-learning-categories.ts
npx ts-node src/scripts/seed-interests-categories.ts
```

**Cenário B: Categorias existem mas com status errado**
```sql
-- Atualizar categorias existentes para active
UPDATE categories 
SET status = 'active' 
WHERE status IS NULL OR status = 'pending';
```

**Cenário C: Coluna status não existe**
```sql
-- Migration 055 não foi aplicada corretamente
-- Executar manualmente:
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

-- Aplicar constraint
ALTER TABLE categories
ADD CONSTRAINT categories_status_check
CHECK (status IN ('active', 'auto_active', 'pending', 'rejected', 'archived'));
```

---

## 🔴 PROBLEMA 2: ERRO AO CRIAR EMPRESA (CNPJ)

### Diagnóstico

**Erro Reportado:**
```
a nova linha da relação "companies" viola a restrição de verificação "companies_cnpj_format"
```

### Causa Raiz Identificada

Existem **DUAS constraints** com nomes diferentes para o mesmo campo:

1. **`companies_cnpj_digits_only`** — criada na migration 047 (linha 61)
   - Regex: `'^[0-9]{14}$'`
   - ✅ Correta (apenas números)

2. **`companies_cnpj_format`** — criada/modificada nas migrations 099 e 100
   - Regex: `'^[0-9]{14}$'`
   - ⚠️ Pode ter sido criada com regex errada antes de ser corrigida

### Possíveis Cenários

1. **Migrations executadas fora de ordem** — se 099/100 foram aplicadas antes do banco ter a constraint `companies_cnpj_format`, ela pode ter sido criada com regex diferente
2. **Constraint antiga ainda existe** com regex de formatação (com pontos/barras)

### Como Verificar no Banco

```sql
-- Listar todas as constraints da tabela companies
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'companies'::regclass 
  AND contype = 'c';
```

### Correção

```sql
-- Remover constraints conflitantes
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_cnpj_format;
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_cnpj_digits_only;

-- Criar uma única constraint definitiva
ALTER TABLE companies
ADD CONSTRAINT companies_cnpj_format
CHECK (cnpj ~ '^[0-9]{14}$');
```

---

## 🟡 PROBLEMA 3: MIGRATIONS DUPLICADAS

### Arquivos Identificados

```
100_add_years_experience_and_hourly_rate.sql
100_fix_post_migration_issues.sql   ← CONFLITO
```

### Impacto

- Ordem de execução **indeterminada** (depende de como o runner ordena arquivos)
- Uma pode sobrescrever o trabalho da outra
- Pode causar erros de constraint/FK

### Correção

**Renumerar migrations:**
```bash
mv 100_add_years_experience_and_hourly_rate.sql 102_add_years_experience_and_hourly_rate.sql
```

Ou manter `100_fix_post_migration_issues.sql` como 100 e renumerar a outra.

---

## 🟡 PROBLEMA 4: AUTOCOMPLETE SUMIU

### Diagnóstico

É **cascata do Problema #1**.

O endpoint `GET /categories/autocomplete` chama:
```typescript
await categoriesService.autocompleteCategories(...)
```

Que por sua vez filtra com `getStatusCondition()` — mesmo filtro da árvore.

### Correção

**Resolver Problema #1 resolve este automaticamente.**

---

## 🟡 PROBLEMA 5: BOTÃO "ADICIONAR EVENTO" SUMIU

### Diagnóstico

**NÃO é problema de categorias.**

O `PostComposer.tsx` (linha 317) tem:
```typescript
const getAvailableExperienceTypes = (): ExperienceType[] => {
  if (!activeActor) return [];  // ← AQUI: sem actor = sem opções
  ...
}
```

Se `activeActor` é null, nenhuma opção de experiência aparece (incluindo `event`).

### Causa Raiz

O `activeActor` vem do `SessionProvider`, que depende de:
1. Autenticação (token)
2. Tenant ID
3. API `getAvailableActors()` retornando dados

**Possíveis falhas:**
- Token inválido/expirado
- Tenant ID não está sendo enviado
- Endpoint `/social/actors/available` retornando erro ou vazio

### Como Verificar

1. **No frontend (console do browser):**
```javascript
// Verificar se activeActor existe
localStorage.getItem('unificard_active_actor_id')
```

2. **No backend (logs):**
```
[SessionProvider] ❌ Não autenticado - bootstrap cancelado
```

3. **Chamar API diretamente:**
```bash
curl -H "Authorization: Bearer TOKEN" \
     -H "x-tenant-id: TENANT_ID" \
     http://localhost:3000/social/actors/available
```

### Correção

Se o problema é de sessão/autenticação (já mencionado como resolvido no relatório):
- Verificar se o fix de sessão realmente foi aplicado
- Verificar se não há regressão no `clearAuthToken()` vs `clearSession()`

---

## 📊 ANÁLISE DO SCHEMA DE MIGRATIONS

### Evolução do Campo `status` em Categories

| Migration | Ação | Valores Permitidos |
|-----------|------|-------------------|
| 040 | Criação da tabela | Não existe campo status |
| 055 | Adiciona `status` | `active`, `pending`, `rejected`, `archived` |
| 057 | Atualiza constraint | `active`, `auto_active`, `pending`, `rejected`, `archived` |
| 100 | Verifica/cria status | `active`, `pending`, `rejected`, `archived`, `auto_active` |
| 101 | Limpa dados inconsistentes | N/A |

### Evolução do Campo `cnpj` em Companies

| Migration | Ação | Constraint |
|-----------|------|------------|
| 047 | Criação da tabela | `companies_cnpj_digits_only` → `'^[0-9]{14}$'` |
| 099 | Tenta corrigir | `companies_cnpj_format` → `'^[0-9]{14}$'` |
| 100 | Também tenta corrigir | `companies_cnpj_format` → `'^[0-9]{14}$'` |

**Problema:** Duas constraints com nomes diferentes para o mesmo campo.

---

## ✅ CHECKLIST DE CORREÇÕES

### Prioridade 1 (Crítico)

- [ ] Verificar se tabela `categories` tem dados
- [ ] Verificar status das categorias existentes
- [ ] Executar seeds se necessário OU atualizar status para `active`
- [ ] Remover constraints duplicadas de CNPJ em `companies`

### Prioridade 2 (Médio)

- [ ] Renumerar migration `100_add_years_experience_and_hourly_rate.sql` para `102`
- [ ] Verificar se `activeActor` está sendo carregado corretamente
- [ ] Testar criação de empresa após correção de constraint

### Prioridade 3 (Validação)

- [ ] Testar GET /categories/tree — deve retornar árvore completa
- [ ] Testar GET /categories/autocomplete — deve retornar sugestões
- [ ] Testar POST /companies — deve criar empresa com CNPJ apenas números
- [ ] Testar PostComposer — botão de evento deve aparecer

---

## 🔧 SCRIPT DE VERIFICAÇÃO RÁPIDA

Execute este SQL no banco para diagnóstico instantâneo:

```sql
-- === DIAGNÓSTICO RÁPIDO ===

-- 1. CATEGORIAS
SELECT 
  'categories' as tabela,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
  SUM(CASE WHEN status = 'auto_active' THEN 1 ELSE 0 END) as auto_active,
  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
  SUM(CASE WHEN status IS NULL THEN 1 ELSE 0 END) as null_status
FROM categories;

-- 2. CONSTRAINTS DE CNPJ
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'companies'::regclass 
  AND conname LIKE '%cnpj%';

-- 3. CATEGORIAS RAIZ (devem existir)
SELECT category_id, name, status, parent_id 
FROM categories 
WHERE parent_id IS NULL
LIMIT 10;
```

---

## 📝 NOTAS IMPORTANTES

1. **NÃO resetar o banco** — preservar dados existentes
2. **Migrations são idempotentes** — podem ser executadas múltiplas vezes
3. **Seeds verificam existência** — não criam duplicatas
4. **Ordem de execução** — crítica para constraints e FKs

---

*Diagnóstico gerado automaticamente via auditoria do codebase*
