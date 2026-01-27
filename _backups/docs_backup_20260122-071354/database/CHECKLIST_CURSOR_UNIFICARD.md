# 🎯 CHECKLIST CURSOR — CORREÇÕES UNIFICARD

**REGRA:** Execute PASSO a PASSO. Não pule. Valide cada um antes de avançar.

---

## 🟥 PASSO 0 — SANIDADE (5 min)

### No terminal do backend:
```bash
cd backend
npm run dev
# ou
npm start
```

### Verificar:
```bash
curl http://localhost:3000/health
```

**Esperado:** `{ "status": "ok" }` ou similar

**Se falhar → PARE. Problema é de ambiente, não de migration.**

---

## 🟥 PASSO 1 — MIGRATIONS DUPLICADAS

### 1.1 Localizar no Cursor

Abra: `backend/migrations/`

Você verá:
```
100_add_years_experience_and_hourly_rate.sql
100_fix_post_migration_issues.sql  ← CONFLITO
```

### 1.2 Corrigir

**Renomear o arquivo:**
```
100_add_years_experience_and_hourly_rate.sql → 102_add_years_experience_and_hourly_rate.sql
```

**Comando terminal (se preferir):**
```bash
cd backend/migrations
mv 100_add_years_experience_and_hourly_rate.sql 102_add_years_experience_and_hourly_rate.sql
```

### ✅ Critério de Aceite
```bash
ls backend/migrations/100_*.sql
# Deve retornar APENAS UM arquivo
```

---

## 🟥 PASSO 2 — CNPJ (BUG CRÍTICO)

### 2.1 Verificar constraints no banco

**Execute no PostgreSQL:**
```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'companies'::regclass
AND conname ILIKE '%cnpj%';
```

**Resultado esperado:** Pode ter duas constraints (`companies_cnpj_digits_only` e `companies_cnpj_format`)

### 2.2 Verificar normalização no backend

**Abra no Cursor:** `backend/src/core/companies/companies.service.ts`

**Procure (Ctrl+F):** `createCompany`

**Verifique se existe (linha ~226):**
```typescript
const normalizedCNPJ = input.cnpj.replace(/\D/g, '');
```

**SE EXISTIR:** O backend já normaliza. O problema é a constraint duplicada.

### 2.3 Correção no banco

**Execute no PostgreSQL:**
```sql
-- Remover constraints conflitantes
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_cnpj_format;
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_cnpj_digits_only;

-- Criar constraint única e definitiva
ALTER TABLE companies
ADD CONSTRAINT companies_cnpj_format
CHECK (cnpj ~ '^[0-9]{14}$');
```

### 2.4 Criar migration de correção (opcional, para não repetir)

**Criar arquivo:** `backend/migrations/103_fix_cnpj_constraint_final.sql`

```sql
-- ============================================================
-- UNIFICARD — MIGRATION 103
-- Correção definitiva de constraint CNPJ
-- ============================================================

-- Remover constraints antigas (podem coexistir)
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_cnpj_format;
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_cnpj_digits_only;

-- Criar constraint única
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_cnpj_format'
  ) THEN
    ALTER TABLE companies
    ADD CONSTRAINT companies_cnpj_format
    CHECK (cnpj ~ '^[0-9]{14}$');
  END IF;
END $$;
```

### ✅ Critério de Aceite

**Testar criação de empresa:**
```bash
curl -X POST http://localhost:3000/companies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "x-tenant-id: SEU_TENANT" \
  -d '{"cnpj": "12.345.678/0001-90", "companyName": "Teste LTDA"}'
```

**Verificar no banco:**
```sql
SELECT cnpj FROM companies ORDER BY created_at DESC LIMIT 1;
-- Deve mostrar: 12345678000190 (apenas números)
```

---

## 🟥 PASSO 3 — CATEGORIAS (NÚCLEO DO PROBLEMA)

### 3.1 Diagnóstico no banco

**Execute no PostgreSQL:**
```sql
-- Quantas categorias existem?
SELECT COUNT(*) as total FROM categories;

-- Distribuição por status
SELECT status, COUNT(*) as qtd 
FROM categories 
GROUP BY status
ORDER BY qtd DESC;

-- Categorias raiz (devem existir)
SELECT category_id, name, status, country_code
FROM categories 
WHERE parent_id IS NULL
LIMIT 10;

-- Verificar se coluna status existe
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'categories' AND column_name = 'status';
```

### 3.2 Identificar filtros no backend

**Abra no Cursor:** `backend/src/core/categories/categories.repository.ts`

**Procure (Ctrl+F):** `getStatusCondition`

**Você vai encontrar (linha ~18-26):**
```typescript
private async getStatusCondition(): Promise<string> {
  const hasStatus = await this.hasStatusColumn();
  if (!hasStatus) {
    return '1=1';
  }
  return '(status IN (\'active\', \'auto_active\') OR status IS NULL)';
}
```

**ESTE É O FILTRO.** Categorias só aparecem se:
- `status = 'active'` OU
- `status = 'auto_active'` OU
- `status IS NULL`

### 3.3 Correção baseada no diagnóstico

#### CENÁRIO A: Tabela vazia (COUNT = 0)

**Executar seeds:**
```bash
cd backend
npx ts-node src/scripts/seed-professional-categories.ts
npx ts-node src/scripts/seed-physical-categories.ts
npx ts-node src/scripts/seed-learning-categories.ts
npx ts-node src/scripts/seed-interests-categories.ts
```

#### CENÁRIO B: Categorias existem mas status = 'pending'

**Corrigir no banco:**
```sql
-- Atualizar categorias para active
UPDATE categories 
SET status = 'active' 
WHERE status = 'pending' OR status IS NULL;

-- Verificar resultado
SELECT status, COUNT(*) FROM categories GROUP BY status;
```

#### CENÁRIO C: Coluna status não existe

**Criar coluna:**
```sql
-- Adicionar coluna
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

-- Adicionar constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_status_check'
  ) THEN
    ALTER TABLE categories
    ADD CONSTRAINT categories_status_check
    CHECK (status IN ('active', 'auto_active', 'pending', 'rejected', 'archived'));
  END IF;
END $$;
```

### ✅ Critério de Aceite

**Testar endpoint:**
```bash
curl http://localhost:3000/categories/tree \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "x-tenant-id: SEU_TENANT"
```

**Esperado:** Array com categorias, não `[]`

**Testar autocomplete:**
```bash
curl "http://localhost:3000/categories/autocomplete?q=ped&context=professional" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "x-tenant-id: SEU_TENANT"
```

**Esperado:** Resultados como "Pedreiro", "Pediatra", etc.

---

## 🟥 PASSO 4 — MICROFONE

### 4.1 Verificar se é dependência de categorias

**Se PASSO 3 foi corrigido e microfone ainda não aparece:**

**Abra no Cursor:** `frontend/src/` e busque por `microphone`, `voice`, `speech`

**Verificar feature flag:**
- Procure por `VITE_DEV_PLAN` ou similar
- Pode estar em `.env` ou contexto de plano

### 4.2 Forçar plano em DEV

**Em `frontend/.env` ou `.env.local`:**
```
VITE_DEV_PLAN=pro
```

### ✅ Critério de Aceite

- Campo de voz/microfone aparece na UI
- Funciona para entrada de texto

---

## 🟥 PASSO 5 — BOTÃO "ADICIONAR EVENTO"

### 5.1 Verificar activeActor

**Abra no Cursor:** `frontend/src/components/social/PostComposer.tsx`

**Procure (linha ~317):**
```typescript
const getAvailableExperienceTypes = (): ExperienceType[] => {
  if (!activeActor) return [];  // ← SE CHEGAR AQUI, NADA APARECE
  ...
}
```

### 5.2 Adicionar log de debug temporário

**Modifique temporariamente:**
```typescript
const getAvailableExperienceTypes = (): ExperienceType[] => {
  console.log('[DEBUG] activeActor:', activeActor);
  if (!activeActor) {
    console.warn('[DEBUG] activeActor é NULL - nenhuma opção disponível');
    return [];
  }
  ...
}
```

### 5.3 Verificar no browser console

Abra DevTools (F12) → Console

**Se aparecer `activeActor é NULL`:**
- Problema é de autenticação/sessão/actors
- Verificar se `/social/actors/available` retorna dados

**Testar API diretamente:**
```bash
curl http://localhost:3000/social/actors/available \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "x-tenant-id: SEU_TENANT"
```

**Esperado:** Array com pelo menos um actor (user ou page)

### 5.4 Se actors não retornam

**Verificar no banco:**
```sql
-- Verificar se actors existem para o usuário
SELECT * FROM actors 
WHERE user_id = 'SEU_USER_ID' 
   OR global_user_id = 'SEU_GLOBAL_USER_ID';
```

**Se vazio, o problema é que o actor não foi criado no login/registro.**

### ✅ Critério de Aceite

- Opção "Evento" aparece no PostComposer
- Consegue criar evento
- Evento aparece no feed

---

## 🟥 PASSO 6 — REGRESSÃO FINAL

### Roteiro de teste (na ordem):

1. **Criar empresa**
   - [ ] CNPJ com máscara funciona
   - [ ] Empresa aparece no sistema

2. **Perfil profissional**
   - [ ] Árvore de categorias carrega
   - [ ] Pode selecionar profissão

3. **Autocomplete**
   - [ ] Digitar "ped" retorna "Pedreiro"
   - [ ] Funciona em todos os contextos

4. **Microfone**
   - [ ] Ícone aparece (se plano permitir)
   - [ ] Entrada de voz funciona

5. **Criar evento**
   - [ ] Botão "Evento" aparece
   - [ ] Pode criar evento
   - [ ] Evento publicado aparece no feed

6. **Feed**
   - [ ] Feed carrega sem erros
   - [ ] Posts aparecem
   - [ ] Eventos aparecem

---

## 📋 COMANDOS SQL DE REFERÊNCIA RÁPIDA

```sql
-- === DIAGNÓSTICO COMPLETO ===

-- Categorias
SELECT 'categories' as tabela, COUNT(*) as total FROM categories;
SELECT status, COUNT(*) FROM categories GROUP BY status;

-- Empresas
SELECT 'companies' as tabela, COUNT(*) as total FROM companies;

-- Constraints CNPJ
SELECT conname FROM pg_constraint 
WHERE conrelid = 'companies'::regclass AND conname LIKE '%cnpj%';

-- Actors
SELECT actor_type, COUNT(*) FROM actors GROUP BY actor_type;

-- === CORREÇÕES RÁPIDAS ===

-- Categorias: forçar active
UPDATE categories SET status = 'active' WHERE status != 'active';

-- CNPJ: constraint única
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_cnpj_format;
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_cnpj_digits_only;
ALTER TABLE companies ADD CONSTRAINT companies_cnpj_format CHECK (cnpj ~ '^[0-9]{14}$');
```

---

## ⚠️ REGRA FINAL

```
Migration muda regra → Backend ajusta → Frontend ajusta

Se um não acompanhar, cascata de erros.
```

---

*Checklist gerado para execução via Cursor*
