# ANÁLISE CIRÚRGICA - FASE 3.7 (Fluxo "Dentista")

## ✅ RESPOSTA 1: Onde o backend impede suggest-path/createCategoryWithAI de sugerir/criar raiz

**DESCOBERTA: O sistema NÃO está mais bloqueando criação de raiz.**

### Arquivos e Lógicas Relevantes:

1. **`backend/src/core/categories/categories.service.ts` - Linha 755**
   ```
   Regra no prompt: "NUNCA sugerir criar profissão como categoria raiz (level 0)"
   ```
   **ISSO ESTÁ CORRETO** - "Dentista" deve ser folha (level 2), não raiz.

2. **`backend/src/core/categories/categories.service.ts` - Linhas 1007-1046**
   ```typescript
   // Se IA não sugeriu grupo - criar baseado no contexto
   const inferredGroup = this.inferGroupName(profession, context);
   const groupSlug = this.generateSlug(inferredGroup);
   // ... cria grupo automaticamente
   ```
   **A função `ensureCompleteHierarchy()` JÁ CRIA raiz automaticamente quando IA não sugere.**

3. **`backend/src/core/categories/categories.service.ts` - Linhas 1628-1631**
   ```typescript
   // FASE 3.6: VALIDAÇÃO CRÍTICA - NUNCA criar profissão como raiz
   if (!finalParentId) {
     throw new Error('Não é possível criar profissão sem grupo ou subgrupo...');
   }
   ```
   **ISSO ESTÁ CORRETO** - Só bloqueia se `ensureCompleteHierarchy` falhou.

### 🟡 DIAGNÓSTICO PARCIAL:
O bloqueio de raiz **não é mais o problema principal**. A função `ensureCompleteHierarchy()` deveria criar grupo/subgrupo automaticamente. O problema real está no **mapeamento de profissões** (próxima seção).

---

## ✅ RESPOSTA 2: Onde falta idempotência (get-or-create)

### DESCOBERTA: EXISTE idempotência, mas está INCOMPLETA.

### Arquivo: `backend/src/core/categories/categories.service.ts`

**A) createCategory() já tem idempotência (linhas 163-169):**
```typescript
// FASE 3.6: Verificar se categoria já existe (por slug e parent, ou por nome e parent)
const existing = await this.checkCategoryExists(input.name, slug, parentId);
if (existing) {
  // Se encontrou categoria existente no mesmo nível, retornar ela ao invés de criar
  return CategoryModel.fromRow(existing);
}
```
**✅ Isso funciona.**

**B) O BUG está em `checkCategoryExists()` (linhas 1447-1451):**
```typescript
// 1. Buscar por slug exato no mesmo nível (mesmo parent)
const bySlug = await this.repository.findBySlug(normalizedSlug);
if (bySlug && bySlug.parent_id === parentId) {
  return bySlug;
}
```

### 🔴 PROBLEMA CRÍTICO:
`findBySlug()` busca **global** (sem considerar parent), mas o `if` verifica se o parent bate. Se não bate, **retorna null** e tenta criar nova categoria, que vai dar erro "slug já existe" no banco.

**Cenário de bug:**
1. Existe "Saúde" como raiz (parent_id = null, slug = "saude")
2. Sistema procura "Saúde" com parent_id = null
3. `findBySlug("saude")` retorna a categoria
4. `parent_id === null` → true → retorna existente ✅

**Cenário que duplica:**
1. Existe "Odontologia" sob "Saúde" (parent_id = "xxx", slug = "odontologia")
2. Sistema procura "Odontologia" com parent_id = "yyy" (outro pai)
3. `findBySlug("odontologia")` retorna a existente
4. `parent_id === "yyy"` → false (porque é "xxx")
5. Retorna null → tenta criar → ERRO "slug já existe"

### 🔧 FIX NECESSÁRIO (Linhas 1447-1460):
```typescript
private async checkCategoryExists(
  name: string, 
  slug: string, 
  parentId: string | null = null,
  context?: 'professional' | 'interest' | 'lifestyle' | 'education'
): Promise<CategoryRow | null> {
  const normalizedSlug = this.generateSlug(slug || name);
  
  // 1. Buscar por slug exato no mesmo nível (mesmo parent)
  // FIX: Usar repository.findBySlugAndParent() ao invés de findBySlug()
  const bySlug = await this.repository.findBySlugAndParent(normalizedSlug, parentId);
  if (bySlug) {
    return bySlug;
  }
  
  // 2. Buscar por nome exato (case-insensitive) no mesmo nível
  const byName = await this.repository.findByNameAndParent(name, parentId);
  if (byName) {
    return byName;
  }
  
  return null;
}
```

**E criar `findBySlugAndParent` no repository:**
```typescript
async findBySlugAndParent(slug: string, parentId: string | null): Promise<CategoryRow | null> {
  const statusCondition = await this.getStatusCondition();
  const result = await pool.query<CategoryRow>(
    `
    SELECT category_id, parent_id, name, slug, description, level, path, 
           COALESCE(keywords, '[]'::jsonb) as keywords, country_code, created_at, updated_at
    FROM categories
    WHERE slug = $1 
      AND (parent_id = $2 OR (parent_id IS NULL AND $2 IS NULL))
      AND ${statusCondition}
    LIMIT 1
    `,
    [slug, parentId]
  );
  return result.rows[0] || null;
}
```

---

## ✅ RESPOSTA 3: Onde o frontend duplica a árvore

### DESCOBERTA: O frontend NÃO está duplicando por merge/append.

### Arquivo: `frontend/src/components/ProfileProfessional.tsx`

**Atualização da árvore (linhas 387-388):**
```typescript
// Recarregar árvore de categorias
const tree = await getCategoryTree();
setCategoryTree(tree);  // SUBSTITUIÇÃO, não merge
```
**✅ Isso está correto** - é uma substituição completa.

### 🟡 DIAGNÓSTICO:
A duplicação visual de "Saúde" provavelmente é causada por:

1. **Dados duplicados no banco** - Duas categorias com nomes similares ("Saúde", "Saúde e Bem-Estar") criadas em tentativas anteriores
2. **Cache do backend** - `getCategoryTree()` usa cache de 60s (linha 300)

### 🔍 PARA CONFIRMAR, EXECUTAR NO BANCO:
```sql
SELECT category_id, parent_id, name, slug, status, level 
FROM categories 
WHERE name ILIKE '%saúde%' OR name ILIKE '%saude%'
ORDER BY level, name;
```

Se retornar mais de uma raiz com "Saúde", o problema é dados duplicados no banco (não frontend).

### 🔧 FIX PARA CACHE:
Após criar categoria, invalidar cache explicitamente:

**`backend/src/core/categories/categories.service.ts` - Após linha 1704:**
```typescript
// 12b. CACHE: Invalidar cache após criar nova categoria
this.invalidateCategoryCache();
```

Verificar se `createCategory()` já invalida (deveria na linha ~211, mas pode não estar sendo chamado em todos os caminhos).

---

## 📋 RESUMO EXECUTIVO

| # | Problema | Arquivo | Linha | Severidade | Status |
|---|----------|---------|-------|------------|--------|
| 1 | Bloqueio de raiz | categories.service.ts | 755, 1628 | ✅ RESOLVIDO | Não é mais problema |
| 2 | Idempotência | categories.service.ts | 1447-1451 | 🔴 CRÍTICO | Precisa fix |
| 3 | Duplicação frontend | ProfileProfessional.tsx | 387-388 | ✅ OK | Não é o frontend |

### 🎯 AÇÃO PRIORITÁRIA:
**Corrigir `checkCategoryExists()` para usar `findBySlugAndParent()` ao invés de `findBySlug()` + comparação manual de parent.**

### 🧪 TESTE APÓS FIX:
1. Limpar categorias duplicadas do banco (se houver)
2. Digitar "Dentista" no frontend
3. Deve criar: Saúde → Odontologia → Dentista
4. Recarregar página - sem duplicação
5. Digitar "Dentista" novamente - deve retornar existente, não criar

---

## 🔧 PATCH MINIMALISTA RECOMENDADO

### 1. Criar `findBySlugAndParent` no repository (categories.repository.ts):
```typescript
async findBySlugAndParent(slug: string, parentId: string | null): Promise<CategoryRow | null> {
  const statusCondition = await this.getStatusCondition();
  const parentCondition = parentId === null 
    ? 'parent_id IS NULL' 
    : 'parent_id = $2';
  
  const query = `
    SELECT category_id, parent_id, name, slug, description, level, path, 
           COALESCE(keywords, '[]'::jsonb) as keywords, country_code, created_at, updated_at
    FROM categories
    WHERE slug = $1 
      AND ${parentCondition}
      AND ${statusCondition}
    LIMIT 1
  `;
  
  const params = parentId === null ? [slug] : [slug, parentId];
  const result = await pool.query<CategoryRow>(query, params);
  return result.rows[0] || null;
}
```

### 2. Alterar `checkCategoryExists` (categories.service.ts linha 1448):
```diff
- const bySlug = await this.repository.findBySlug(normalizedSlug);
- if (bySlug && bySlug.parent_id === parentId) {
-   return bySlug;
- }
+ const bySlug = await this.repository.findBySlugAndParent(normalizedSlug, parentId);
+ if (bySlug) {
+   return bySlug;
+ }
```

### 3. Garantir invalidação de cache (categories.service.ts, após criar categoria):
Verificar se `this.invalidateCategoryCache()` é chamado em todos os caminhos de criação dentro de `ensureCompleteHierarchy()`.
