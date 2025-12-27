# DIAGNÓSTICO: Por Que o Fluxo Ainda Falha

**Autor:** Arquitetura de IA + Backend  
**Data:** 2024-12-XX  
**Status:** Análise Técnica

---

## PROBLEMAS IDENTIFICADOS NO CÓDIGO ATUAL

### Problema #1: `suggestCategoryPath` Não Garante Hierarquia Completa

**Localização:** `categories.service.ts:750-949`

**Análise:**
```typescript
// A IA recebe prompt, mas a resposta pode ser:
{
  suggestedRoot: null,        // ❌ IA não sugeriu
  suggestedParent: null,     // ❌ IA não sugeriu
  leafName: "Dentista"       // ✅ Apenas leaf
}
```

**Causa Raiz:**
- Prompt da IA é instrucional, mas não há **validação obrigatória** da resposta
- Se IA retornar incompleto, o código tenta processar mesmo assim
- `ensureCompleteHierarchy` tenta corrigir, mas pode falhar se IA não sugeriu nada

**Solução:**
```typescript
// APÓS receber resposta da IA:
if (!suggestion.suggestedRoot?.name) {
  suggestion.suggestedRoot = {
    name: inferGroupName(text, context),
    slug: generateSlug(inferGroupName(text, context))
  }
}

if (!suggestion.suggestedParent?.name) {
  suggestion.suggestedParent = {
    name: inferSubgroupName(text, context),
    slug: generateSlug(inferSubgroupName(text, context))
  }
}
```

---

### Problema #2: `ensureCompleteHierarchy` Pode Criar Duplicatas

**Localização:** `categories.service.ts:956-1129`

**Análise:**
```typescript
// Linha 977: Busca por slug, mas pode haver race condition
const existingRoot = await this.repository.findBySlugAndParent(
  pathSuggestion.suggestedRoot.slug, 
  null
);
if (existingRoot) {
  rootId = existingRoot.category_id;
} else {
  // ❌ Cria sem verificar novamente (race condition)
  const rootCategory = await this.createCategory(...)
}
```

**Causa Raiz:**
- Entre `findBySlugAndParent` e `createCategory`, outro processo pode criar
- `createCategory` internamente verifica, mas pode haver janela de tempo
- Se dois processos executam simultaneamente, ambos podem criar

**Solução:**
```typescript
// Usar UPSERT ou transação com lock
BEGIN TRANSACTION;
  existing = findBySlugAndParent(slug, parentId);
  if (!existing) {
    created = createCategory(...);
  }
COMMIT;
```

**OU** (mais simples):
```typescript
// createCategory já verifica internamente, mas precisa retornar existente
const rootCategory = await this.createCategory(...)
// Se createCategory encontrar existente, retorna ele
// Se não encontrar, cria novo
```

---

### Problema #3: `suggestCategoryPath` Usa `findBySlug` Global

**Localização:** `categories.service.ts:835, 861, 880, 911`

**Análise:**
```typescript
// Linha 835:
const root = await this.repository.findBySlug(
  aiSuggestion.suggestedRoot.slug, 
  searchCountryCode
);
```

**Causa Raiz:**
- `findBySlug` é busca global (não considera parent_id)
- Pode encontrar categoria errada (ex: "Saúde" como subgrupo ao invés de raiz)
- Pode causar confusão na hierarquia

**Solução:**
```typescript
// Usar findBySlugAndParent com parentId explícito
const root = await this.repository.findBySlugAndParent(
  aiSuggestion.suggestedRoot.slug,
  null // Raiz sempre tem parent_id = null
);
```

---

### Problema #4: Falta de Validação de Nível na IA

**Análise:**
A IA pode sugerir:
```json
{
  "suggestedRoot": { "name": "Dentista" },  // ❌ ERRADO: Dentista não é raiz
  "suggestedParent": null,
  "leafName": "Dentista"
}
```

**Causa Raiz:**
- Prompt não é suficientemente restritivo
- IA pode confundir níveis
- Não há validação semântica da resposta

**Solução:**
```typescript
// Validação obrigatória após receber resposta da IA
function validateSuggestion(suggestion, inputText) {
  // Regra: Leaf nunca pode ser igual ao root
  if (suggestion.suggestedRoot?.name?.toLowerCase() === 
      suggestion.leafName?.toLowerCase()) {
    throw new Error("IA sugeriu profissão como raiz. Corrigindo...");
  }
  
  // Regra: Root deve ser categoria ampla (Saúde, Tecnologia, etc)
  const validRoots = ["Saúde", "Tecnologia", "Construção", "Educação", ...];
  if (!validRoots.includes(suggestion.suggestedRoot?.name)) {
    suggestion.suggestedRoot = inferRoot(inputText);
  }
}
```

---

### Problema #5: `createCategory` Pode Não Ser Idempotente em Todos os Caminhos

**Localização:** `categories.service.ts:134-230`

**Análise:**
```typescript
// Linha 165: Verifica existência
const existing = await this.checkCategoryExists(input.name, slug, parentId);
if (existing) {
  return CategoryModel.fromRow(existing); // ✅ Correto
}

// Mas se checkCategoryExists retornar null incorretamente:
// - Pode criar duplicata
// - Pode gerar erro de constraint
```

**Causa Raiz:**
- `checkCategoryExists` pode ter bug
- Race condition entre verificação e criação
- Se `findBySlugAndParent` falhar silenciosamente, cria duplicata

**Solução:**
```typescript
// Adicionar constraint UNIQUE no banco
ALTER TABLE categories 
ADD CONSTRAINT categories_slug_parent_unique 
UNIQUE (slug, parent_id);

// E usar ON CONFLICT no INSERT
INSERT INTO categories (...) 
VALUES (...)
ON CONFLICT (slug, parent_id) 
DO UPDATE SET updated_at = NOW()
RETURNING *;
```

---

## RECOMENDAÇÕES PRIORITÁRIAS

### Prioridade 1: Validação Obrigatória da Resposta da IA

**Ação:**
```typescript
function validateAndFixSuggestion(suggestion, inputText, context) {
  // Garantir que sempre há root
  if (!suggestion.suggestedRoot?.name) {
    suggestion.suggestedRoot = {
      name: inferGroupName(inputText, context),
      slug: generateSlug(inferGroupName(inputText, context))
    };
  }
  
  // Garantir que sempre há subgroup
  if (!suggestion.suggestedParent?.name) {
    suggestion.suggestedParent = {
      name: inferSubgroupName(inputText, context),
      slug: generateSlug(inferSubgroupName(inputText, context))
    };
  }
  
  // Garantir que sempre há leaf
  if (!suggestion.leafName) {
    suggestion.leafName = normalizeTitleCase(inputText);
  }
  
  // Validar semântica
  if (suggestion.suggestedRoot.name.toLowerCase() === 
      suggestion.leafName.toLowerCase()) {
    throw new Error("IA sugeriu profissão como raiz");
  }
  
  return suggestion;
}
```

### Prioridade 2: Substituir `findBySlug` por `findBySlugAndParent`

**Ação:**
- Buscar todas as ocorrências de `findBySlug` em `suggestCategoryPath`
- Substituir por `findBySlugAndParent` com parentId explícito
- Raiz: `findBySlugAndParent(slug, null)`
- Subgrupo: `findBySlugAndParent(slug, rootId)`

### Prioridade 3: Adicionar Constraint UNIQUE no Banco

**Ação:**
```sql
-- Migration
ALTER TABLE categories 
ADD CONSTRAINT categories_slug_parent_unique 
UNIQUE (slug, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Ou usar índice parcial
CREATE UNIQUE INDEX categories_slug_parent_unique 
ON categories (slug, parent_id) 
WHERE parent_id IS NULL;

CREATE UNIQUE INDEX categories_slug_parent_unique_not_null 
ON categories (slug, parent_id) 
WHERE parent_id IS NOT NULL;
```

### Prioridade 4: Transação com Lock para Race Conditions

**Ação:**
```typescript
async function resolveOrCreateCategory(
  name: string,
  slug: string,
  parentId: string | null
): Promise<CategoryRow> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Lock na tabela para evitar race condition
    await client.query('LOCK TABLE categories IN SHARE ROW EXCLUSIVE MODE');
    
    // Verificar novamente dentro da transação
    const existing = await client.query(
      parentId === null
        ? 'SELECT * FROM categories WHERE slug = $1 AND parent_id IS NULL'
        : 'SELECT * FROM categories WHERE slug = $1 AND parent_id = $2::uuid',
      parentId === null ? [slug] : [slug, parentId]
    );
    
    if (existing.rows.length > 0) {
      await client.query('COMMIT');
      return existing.rows[0];
    }
    
    // Criar dentro da transação
    const created = await client.query(
      'INSERT INTO categories (...) VALUES (...) RETURNING *',
      [...]
    );
    
    await client.query('COMMIT');
    return created.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

---

## CHECKLIST DE CORREÇÃO

- [ ] **Validação obrigatória da resposta da IA** (garantir root, subgroup, leaf)
- [ ] **Substituir `findBySlug` por `findBySlugAndParent`** em `suggestCategoryPath`
- [ ] **Adicionar constraint UNIQUE** no banco (slug, parent_id)
- [ ] **Transação com lock** para evitar race conditions
- [ ] **Validação semântica** (root não pode ser igual a leaf)
- [ ] **Fallback robusto** se IA retornar incompleto
- [ ] **Testes de concorrência** (múltiplos processos criando mesma categoria)

---

## CONCLUSÃO

O sistema atual tem a estrutura correta, mas falha em:

1. **Validação da resposta da IA**: Assume que IA sempre retorna completo
2. **Busca contextual**: Usa busca global em alguns lugares
3. **Race conditions**: Não protege contra criação simultânea
4. **Validação semântica**: Não valida se hierarquia faz sentido

As correções propostas garantem que o fluxo seja **100% robusto e idempotente**.















