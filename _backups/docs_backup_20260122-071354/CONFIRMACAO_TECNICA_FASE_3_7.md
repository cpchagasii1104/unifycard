# CONFIRMAÇÃO TÉCNICA FINAL - FASE 3.7

## ✅ CAUSA RAIZ CONFIRMADA

### Arquivo: `backend/src/core/categories/categories.service.ts`
### Linhas: 1447-1451

```typescript
// CÓDIGO ATUAL (BUGADO)
private async checkCategoryExists(
  name: string, 
  slug: string, 
  parentId: string | null = null,
  context?: 'professional' | 'interest' | 'lifestyle' | 'education'
): Promise<CategoryRow | null> {
  const normalizedSlug = this.generateSlug(slug || name);
  
  // 🔴 BUG: findBySlug busca GLOBAL (ignora parent)
  const bySlug = await this.repository.findBySlug(normalizedSlug);
  // 🔴 BUG: Comparação manual falha se slug existe em outro nível
  if (bySlug && bySlug.parent_id === parentId) {
    return bySlug;
  }
  // ...
}
```

### Cenário de Falha:
1. Existe "Odontologia" como subgrupo de "Saúde" (parent_id = "uuid-saude")
2. IA tenta criar novo subgrupo "Odontologia" sob outra raiz
3. `findBySlug("odontologia")` retorna a existente
4. `bySlug.parent_id === parentId` → `"uuid-saude" === "uuid-outro"` → **false**
5. Retorna `null` → tenta criar → **ERRO: slug já existe**

---

## 🔧 PATCH EXATO

### PASSO 1: Criar método no repository

**Arquivo:** `backend/src/core/categories/categories.repository.ts`
**Inserir após linha 81** (após `findBySlug`):

```typescript
/**
 * Busca categoria por slug E parent_id específico
 * FASE 3.7: Garante idempotência por (slug, parent_id)
 */
async findBySlugAndParent(slug: string, parentId: string | null): Promise<CategoryRow | null> {
  const statusCondition = await this.getStatusCondition();
  const result = await pool.query<CategoryRow>(
    `
    SELECT category_id, parent_id, name, slug, description, level, path, 
           COALESCE(keywords, '[]'::jsonb) as keywords, country_code, created_at, updated_at
    FROM categories
    WHERE slug = $1 
      AND (parent_id IS NULL AND $2 IS NULL OR parent_id = $2)
      AND ${statusCondition}
    LIMIT 1
    `,
    [slug, parentId]
  );
  return result.rows[0] || null;
}
```

### PASSO 2: Alterar checkCategoryExists

**Arquivo:** `backend/src/core/categories/categories.service.ts`
**Linhas 1447-1451** - Substituir:

```typescript
// ANTES (BUGADO):
const bySlug = await this.repository.findBySlug(normalizedSlug);
if (bySlug && bySlug.parent_id === parentId) {
  return bySlug;
}

// DEPOIS (CORRIGIDO):
const bySlug = await this.repository.findBySlugAndParent(normalizedSlug, parentId);
if (bySlug) {
  return bySlug;
}
```

---

## ✅ CACHE - CONFIRMADO OK

O cache já é invalidado corretamente:

- `createCategory()` chama `invalidateCategoryCache()` na linha 227
- `ensureCompleteHierarchy()` usa `createCategory()` para criar raiz/subgrupo
- Todos os caminhos de criação passam por `createCategory()`

**Nenhuma alteração necessária para cache.**

---

## ⚠️ RISCOS COLATERAIS

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Query mais lenta | BAIXA | Índice em (slug, parent_id) se necessário |
| Categorias órfãs | NENHUMA | Não altera lógica de criação |
| Breaking change API | NENHUMA | Método interno, não exposto |

**Risco geral: BAIXO** - É uma alteração cirúrgica em método interno.

---

## 🧹 LIMPEZA DE DADOS (Dev/Staging)

### Script para detectar duplicatas:

```sql
-- Encontrar raízes duplicadas (parent_id IS NULL com nomes similares)
SELECT category_id, parent_id, name, slug, status, level, created_at
FROM categories
WHERE parent_id IS NULL
  AND (name ILIKE '%saúde%' OR name ILIKE '%saude%' 
       OR slug ILIKE '%saude%')
ORDER BY name, created_at;

-- Encontrar subgrupos duplicados
SELECT category_id, parent_id, name, slug, status, level, created_at
FROM categories
WHERE level = 1
  AND (name ILIKE '%odontologia%' OR slug ILIKE '%odontologia%')
ORDER BY parent_id, name, created_at;
```

### Se encontrar duplicatas:

```sql
-- 1. Identificar a categoria "canônica" (mais antiga ou com mais filhos)
-- 2. Reapontar filhos da duplicada para a canônica
UPDATE categories 
SET parent_id = 'uuid-categoria-canonica'
WHERE parent_id = 'uuid-categoria-duplicada';

-- 3. Remover a duplicada
DELETE FROM categories WHERE category_id = 'uuid-categoria-duplicada';

-- 4. Limpar logs se necessário
DELETE FROM category_ai_logs WHERE category_id = 'uuid-categoria-duplicada';
```

---

## 🧪 CHECKLIST DE TESTES

### Cenário 1: Criação Nova
- [ ] Digitar "Dentista" (primeira vez)
- [ ] Verificar criação: Saúde → Odontologia → Dentista
- [ ] Status deve ser `auto_active`
- [ ] Sem erros 409 no console

### Cenário 2: Idempotência
- [ ] Digitar "Dentista" (segunda vez)
- [ ] Deve retornar existente, NÃO criar novo
- [ ] Zero INSERTs no banco

### Cenário 3: Cache
- [ ] F5 imediatamente após criar
- [ ] Árvore deve mostrar sem duplicação
- [ ] "Saúde" aparece UMA vez apenas

### Cenário 4: Variações
- [ ] Digitar "dentista" (minúsculo) → mesma categoria
- [ ] Digitar "DENTISTA" (maiúsculo) → mesma categoria
- [ ] Digitar "Médico" → cria em Saúde → Medicina

### Cenário 5: Outro contexto
- [ ] Digitar "Advogado" → Jurídico → Advocacia → Advogado
- [ ] Sem duplicar "Jurídico" se já existir

---

## 📋 ORDEM DE EXECUÇÃO

```
1. [ ] Criar findBySlugAndParent no repository (10 linhas)
2. [ ] Alterar checkCategoryExists no service (2 linhas)
3. [ ] npm run build (backend)
4. [ ] Executar SQL de diagnóstico (verificar duplicatas)
5. [ ] Limpar duplicatas se existirem
6. [ ] Subir servidor local
7. [ ] Executar testes manuais (5 cenários)
8. [ ] npm run build (frontend) se houver mudanças
```

---

## ✅ CRITÉRIO DE DONE

- [ ] "Dentista" cria hierarquia completa em 1 clique
- [ ] Repetir "Dentista" não cria nada novo
- [ ] Árvore não duplica "Saúde"
- [ ] Zero erros 409/slug conflicts
- [ ] Build backend OK
- [ ] Testes 1-5 passando

---

**Documento gerado em:** 17/12/2024
**Auditor:** Claude (Anthropic)
**Status:** PRONTO PARA IMPLEMENTAÇÃO
