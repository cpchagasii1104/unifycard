# FLUXO CANÔNICO: Criação Hierárquica de Categorias por IA

**Autor:** Arquitetura de IA + Backend  
**Data:** 2024-12-XX  
**Status:** Especificação Técnica

---

## 1. ANÁLISE CONCEITUAL: O PADRÃO CORRETO

### 1.1 Princípios Fundamentais

**A) Separação de Responsabilidades:**
- **IA = Classificadora Semântica**: Decide O QUE criar (grupo, subgrupo, profissão)
- **Sistema = Resolvedor Idempotente**: Decide SE criar ou retornar existente
- **Banco = Fonte de Verdade**: Armazena estado canônico

**B) Ordem de Resolução (Bottom-Up vs Top-Down):**
- ❌ **ERRADO**: Tentar criar profissão primeiro, depois descobrir que precisa de grupo
- ✅ **CORRETO**: Resolver hierarquia de cima para baixo (Root → Subgroup → Leaf)
- **Razão**: Dependências devem existir antes de serem referenciadas

**C) Idempotência em Cada Nível:**
- Cada nível (0, 1, 2) é independente para verificação
- Verificação = `(slug, parent_id)` contextual
- Não existe "busca global" que ignore parent_id

### 1.2 Modelo Mental: State Machine de Resolução

```
INPUT: "Dentista"
  ↓
[FASE 1: NORMALIZAÇÃO]
  → Sanitização
  → Normalização de texto
  → Geração de slug
  ↓
[FASE 2: CLASSIFICAÇÃO SEMÂNTICA (IA)]
  → IA analisa termo
  → IA sugere: { root, subgroup, leaf }
  → IA retorna confidence
  ↓
[FASE 3: RESOLUÇÃO HIERÁRQUICA (Sistema)]
  → Resolver ROOT (level 0)
    ├─ Existe? → Usar
    └─ Não existe? → Criar
  → Resolver SUBGROUP (level 1, parent=root)
    ├─ Existe? → Usar
    └─ Não existe? → Criar
  → Resolver LEAF (level 2, parent=subgroup)
    ├─ Existe? → Retornar existente
    └─ Não existe? → Criar
  ↓
[FASE 4: AUDITORIA + CACHE]
  → Registrar log
  → Invalidar cache
  → Retornar resultado
```

---

## 2. FLUXO CANÔNICO DE ALGORITMO

### 2.1 Pseudocódigo Estruturado

```typescript
ALGORITMO: createCategoryHierarchy(input: string, context: string)

// ============================================
// FASE 1: NORMALIZAÇÃO E SANITIZAÇÃO
// ============================================
FUNÇÃO normalizeInput(text: string) RETORNA string:
  sanitized = removeScripts(text)
  sanitized = removeSQLInjection(sanitized)
  sanitized = removeURLs(sanitized)
  sanitized = trim(sanitized)
  SE sanitized.length < 2:
    LANÇAR ERRO("Texto inválido após sanitização")
  RETORNAR sanitized

slug = generateSlug(sanitized)
textHash = sha256(sanitized)

// ============================================
// FASE 2: VERIFICAÇÃO PRÉVIA (Early Exit)
// ============================================
// Evitar processar IA se já existe
exactMatch = autocomplete(sanitized, context)
SE exactMatch ENCONTRADO:
  existing = findById(exactMatch.id)
  SE existing:
    RETORNAR { created: false, category: existing }

// ============================================
// FASE 3: CLASSIFICAÇÃO SEMÂNTICA (IA)
// ============================================
FUNÇÃO classifyWithAI(text: string, context: string) RETORNA Suggestion:
  tree = getCategoryTree() // Apenas ACTIVE
  prompt = construirPrompt(text, context, tree)
  
  aiResponse = callAI(prompt)
  suggestion = parseJSON(aiResponse)
  
  // VALIDAÇÃO OBRIGATÓRIA da resposta da IA
  SE suggestion.root.name NÃO EXISTE:
    suggestion.root = inferRoot(text, context)
  SE suggestion.subgroup.name NÃO EXISTE:
    suggestion.subgroup = inferSubgroup(text, context)
  SE suggestion.leafName NÃO EXISTE:
    suggestion.leafName = normalizeTitleCase(text)
  
  RETORNAR suggestion

suggestion = classifyWithAI(sanitized, context)

// ============================================
// FASE 4: RESOLUÇÃO HIERÁRQUICA (IDEMPOTENTE)
// ============================================
// CRÍTICO: Resolver de cima para baixo, garantindo existência

// PASSO 4.1: RESOLVER ROOT (level 0, parent_id = NULL)
rootId = null
rootSlug = generateSlug(suggestion.root.name)

existingRoot = findBySlugAndParent(rootSlug, NULL)
SE existingRoot:
  rootId = existingRoot.id
  confidence = min(confidence, existingRoot.confidence || 1.0)
SENÃO:
  root = createCategory({
    name: suggestion.root.name,
    slug: rootSlug,
    parentId: NULL,
    level: 0,
    status: 'auto_active',
    createdByAI: true
  })
  rootId = root.id
  confidence = min(confidence, suggestion.confidence)

// PASSO 4.2: RESOLVER SUBGROUP (level 1, parent_id = rootId)
subgroupId = null
subgroupSlug = generateSlug(suggestion.subgroup.name)

existingSubgroup = findBySlugAndParent(subgroupSlug, rootId)
SE existingSubgroup:
  subgroupId = existingSubgroup.id
  confidence = min(confidence, existingSubgroup.confidence || 1.0)
SENÃO:
  subgroup = createCategory({
    name: suggestion.subgroup.name,
    slug: subgroupSlug,
    parentId: rootId,
    level: 1,
    status: 'auto_active',
    createdByAI: true
  })
  subgroupId = subgroup.id
  confidence = min(confidence, suggestion.confidence)

// VALIDAÇÃO CRÍTICA: Subgroup DEVE existir
SE NÃO subgroupId:
  LANÇAR ERRO("Não foi possível criar ou encontrar subgrupo")

// PASSO 4.3: RESOLVER LEAF (level 2, parent_id = subgroupId)
leafSlug = generateSlug(suggestion.leafName)

existingLeaf = findBySlugAndParent(leafSlug, subgroupId)
SE existingLeaf:
  // IDEMPOTÊNCIA: Retornar existente, não criar duplicata
  RETORNAR { created: false, category: existingLeaf }

// Criar leaf apenas se não existir
leaf = createCategory({
  name: suggestion.leafName,
  slug: leafSlug,
  parentId: subgroupId,
  level: 2,
  status: 'auto_active',
  createdByAI: true
})

// ============================================
// FASE 5: AUDITORIA E CACHE
// ============================================
logCategoryCreation({
  categoryId: leaf.id,
  originalText: input,
  sanitizedText: sanitized,
  textHash: textHash,
  aiSuggestion: suggestion,
  confidence: confidence,
  source: 'ai'
})

invalidateCategoryCache()

RETORNAR { created: true, category: leaf }
```

---

## 3. ARMADILHAS COMUNS E FALHAS TÍPICAS

### 3.1 Armadilha #1: Busca Global por Slug

**❌ ERRADO:**
```typescript
existing = findBySlug("saude") // Busca global, ignora parent_id
if (existing && existing.parent_id === null) {
  // Usar existente
}
```

**Problema:**
- Se "saude" existir como subgrupo (parent_id != null), não encontra
- Se "saude" existir como raiz, pode confundir com subgrupo
- Race condition: dois processos podem criar simultaneamente

**✅ CORRETO:**
```typescript
existing = findBySlugAndParent("saude", NULL) // Contextual
```

### 3.2 Armadilha #2: Ordem de Criação Invertida

**❌ ERRADO:**
```typescript
// Tentar criar profissão primeiro
profession = createCategory({ name: "Dentista", parentId: null })
// Depois descobrir que precisa de grupo
group = createCategory({ name: "Saúde" })
// Atualizar profissão
updateCategory(profession.id, { parentId: group.id })
```

**Problema:**
- Violação de constraint (parent_id não existe)
- Transações complexas
- Rollback difícil

**✅ CORRETO:**
```typescript
// Resolver hierarquia de cima para baixo
root = resolveOrCreate(rootSuggestion, parentId=null)
subgroup = resolveOrCreate(subgroupSuggestion, parentId=root.id)
leaf = resolveOrCreate(leafSuggestion, parentId=subgroup.id)
```

### 3.3 Armadilha #3: IA Retorna Resposta Incompleta

**❌ ERRADO:**
```typescript
suggestion = await callAI(prompt)
// Assumir que suggestion.root sempre existe
root = createCategory(suggestion.root)
```

**Problema:**
- IA pode retornar `null` ou `undefined`
- IA pode não entender contexto
- IA pode sugerir apenas leaf, sem root/subgroup

**✅ CORRETO:**
```typescript
suggestion = await callAI(prompt)

// VALIDAÇÃO + FALLBACK obrigatório
if (!suggestion.root?.name) {
  suggestion.root = inferRoot(text, context)
}
if (!suggestion.subgroup?.name) {
  suggestion.subgroup = inferSubgroup(text, context)
}
if (!suggestion.leafName) {
  suggestion.leafName = normalizeTitleCase(text)
}
```

### 3.4 Armadilha #4: PostgreSQL Parameter Typing

**❌ ERRADO:**
```sql
WHERE slug = $1 
  AND (parent_id IS NULL AND $2 IS NULL OR parent_id = $2)
```

**Problema:**
- PostgreSQL não consegue inferir tipo de `$2` quando pode ser NULL ou UUID
- Erro: "could not determine data type of parameter $2"

**✅ CORRETO:**
```sql
-- CASO 1: parent_id IS NULL
IF parentId IS NULL:
  WHERE slug = $1 AND parent_id IS NULL

-- CASO 2: parent_id = UUID
ELSE:
  WHERE slug = $1 AND parent_id = $2::uuid
```

### 3.5 Armadilha #5: Falta de Idempotência no Retorno

**❌ ERRADO:**
```typescript
existing = findBySlugAndParent(slug, parentId)
if (existing) {
  throw new Error("Categoria já existe") // ❌ Quebra idempotência
}
```

**Problema:**
- Repetir input gera erro ao invés de retornar existente
- Usuário vê erro mesmo quando categoria já existe

**✅ CORRETO:**
```typescript
existing = findBySlugAndParent(slug, parentId)
if (existing) {
  return { created: false, category: existing } // ✅ Idempotente
}
```

### 3.6 Armadilha #6: Cache Não Invalidado

**❌ ERRADO:**
```typescript
createCategory(...)
// Esqueceu de invalidar cache
// UI continua mostrando estado antigo
```

**Problema:**
- UI não reflete mudanças
- Usuário vê dados desatualizados

**✅ CORRETO:**
```typescript
createCategory(...)
invalidateCategoryCache() // Sempre após qualquer mutação
```

---

## 4. STATE MACHINE PROPOSTA

### 4.1 Estados e Transições

```
ESTADOS:
- INITIALIZED
- NORMALIZED
- CLASSIFIED (IA retornou sugestão)
- ROOT_RESOLVED
- SUBGROUP_RESOLVED
- LEAF_RESOLVED
- COMPLETED
- ERROR

TRANSITIONS:
INITIALIZED → NORMALIZED
  [normalizeInput()]

NORMALIZED → CLASSIFIED
  [classifyWithAI()]

CLASSIFIED → ROOT_RESOLVED
  [resolveOrCreateRoot()]

ROOT_RESOLVED → SUBGROUP_RESOLVED
  [resolveOrCreateSubgroup()]

SUBGROUP_RESOLVED → LEAF_RESOLVED
  [resolveOrCreateLeaf()]

LEAF_RESOLVED → COMPLETED
  [audit + invalidateCache()]

QUALQUER_ESTADO → ERROR
  [exception thrown]
```

### 4.2 Implementação da State Machine

```typescript
class CategoryHierarchyResolver {
  private state: State = 'INITIALIZED'
  private context: ResolutionContext = {}
  
  async resolve(input: string, context: string): Promise<Category> {
    try {
      // FASE 1
      this.context.sanitized = this.normalize(input)
      this.state = 'NORMALIZED'
      
      // FASE 2
      this.context.suggestion = await this.classify(this.context.sanitized, context)
      this.state = 'CLASSIFIED'
      
      // FASE 3.1
      this.context.rootId = await this.resolveRoot(this.context.suggestion.root)
      this.state = 'ROOT_RESOLVED'
      
      // FASE 3.2
      this.context.subgroupId = await this.resolveSubgroup(
        this.context.suggestion.subgroup,
        this.context.rootId
      )
      this.state = 'SUBGROUP_RESOLVED'
      
      // FASE 3.3
      const leaf = await this.resolveLeaf(
        this.context.suggestion.leafName,
        this.context.subgroupId
      )
      this.state = 'LEAF_RESOLVED'
      
      // FASE 4
      await this.audit(leaf)
      await this.invalidateCache()
      this.state = 'COMPLETED'
      
      return leaf
    } catch (error) {
      this.state = 'ERROR'
      throw error
    }
  }
  
  private async resolveRoot(suggestion: RootSuggestion): Promise<string> {
    const slug = generateSlug(suggestion.name)
    const existing = await this.repository.findBySlugAndParent(slug, null)
    
    if (existing) {
      return existing.id
    }
    
    const created = await this.repository.create({
      name: suggestion.name,
      slug: slug,
      parentId: null,
      level: 0,
      status: 'auto_active',
      createdByAI: true
    })
    
    return created.id
  }
  
  private async resolveSubgroup(
    suggestion: SubgroupSuggestion,
    rootId: string
  ): Promise<string> {
    const slug = generateSlug(suggestion.name)
    const existing = await this.repository.findBySlugAndParent(slug, rootId)
    
    if (existing) {
      return existing.id
    }
    
    const created = await this.repository.create({
      name: suggestion.name,
      slug: slug,
      parentId: rootId,
      level: 1,
      status: 'auto_active',
      createdByAI: true
    })
    
    return created.id
  }
  
  private async resolveLeaf(
    leafName: string,
    subgroupId: string
  ): Promise<Category> {
    const slug = generateSlug(leafName)
    const existing = await this.repository.findBySlugAndParent(slug, subgroupId)
    
    if (existing) {
      return CategoryModel.fromRow(existing) // IDEMPOTÊNCIA
    }
    
    const created = await this.repository.create({
      name: leafName,
      slug: slug,
      parentId: subgroupId,
      level: 2,
      status: 'auto_active',
      createdByAI: true
    })
    
    return CategoryModel.fromRow(created)
  }
}
```

---

## 5. CHECKLIST DE IMPLEMENTAÇÃO CORRETA

### ✅ Fase 1: Normalização
- [ ] Sanitização remove scripts, SQL, URLs
- [ ] Slug sempre normalizado (lowercase, sem acentos)
- [ ] Hash gerado para auditoria

### ✅ Fase 2: Classificação IA
- [ ] IA recebe contexto completo (tree existente)
- [ ] Prompt explícito sobre hierarquia completa
- [ ] Validação obrigatória da resposta da IA
- [ ] Fallback se IA retornar incompleto

### ✅ Fase 3: Resolução Hierárquica
- [ ] Ordem: Root → Subgroup → Leaf
- [ ] Cada nível verifica existência por `(slug, parent_id)`
- [ ] Queries PostgreSQL separadas (NULL vs UUID)
- [ ] Retorna existente se encontrar (idempotência)

### ✅ Fase 4: Auditoria e Cache
- [ ] Log registrado com todos os metadados
- [ ] Cache invalidado após qualquer mutação
- [ ] Status `auto_active` para categorias IA

### ✅ Validações Finais
- [ ] Repetir input = 0 INSERTs
- [ ] Sem erro 409/slug conflict
- [ ] Sem erro PostgreSQL de tipagem
- [ ] Hierarquia sempre completa (3 níveis)

---

## 6. CONCLUSÃO

O fluxo canônico garante:

1. **Idempotência Total**: Repetir input sempre retorna existente
2. **Hierarquia Completa**: Sempre cria 3 níveis (ou usa existentes)
3. **Segurança**: Sanitização em todas as entradas
4. **Robustez**: Fallbacks se IA falhar
5. **Performance**: Cache invalidado corretamente
6. **Governança**: Auditoria completa sem bloquear fluxo

**O padrão é: Resolver de cima para baixo, verificar contextualmente, retornar existente se encontrar, criar apenas se necessário.**




























