# CATEGORY SCOPES SEMANTICS — UNIFICARD
Status: CANONICAL · BINDING · CORE
Autoridade: NÍVEL 1 (CORE / LEI DO SISTEMA)
Escopo: Definição Semântica Absoluta de Categorias

---

## OBJETIVO

Este documento define **O QUE UMA CATEGORIA É** e **O QUE UMA CATEGORIA NÃO É** no UnifiCard.

Ele existe para **IMPEDIR INSTITUCIONALMENTE** que categorias evoluam para decisão, permissão, ranking ou qualquer forma de comportamento sistêmico.

---

## DEFINIÇÃO ABSOLUTA

### O QUE UMA CATEGORIA É

Uma categoria é:

- **Metadado descritivo** — ajuda humanos a encontrar e organizar informação
- **Taxonomia navegacional** — estrutura hierárquica para exploração
- **Label informativo** — etiqueta que descreve, não classifica
- **Read-model de visualização** — apenas exibe, nunca decide
- **Auxílio de busca** — facilita filtragem humana, não automática

Categorias existem **EXCLUSIVAMENTE** para:
- Navegação humana
- Agrupamento visual
- Organização de informação
- Facilitação de busca manual
- Contextualização informativa

---

### O QUE UMA CATEGORIA NÃO É

Uma categoria **NÃO É**:

- ❌ **Verdade** — categoria não é fonte de verdade
- ❌ **Policy** — categoria não é regra de negócio
- ❌ **Decisão** — categoria não decide comportamento
- ❌ **Permissão** — categoria não autoriza ou bloqueia
- ❌ **Score** — categoria não representa mérito, qualidade ou confiança
- ❌ **Ranking** — categoria não prioriza ou ordena
- ❌ **Preço** — categoria não influencia valor financeiro
- ❌ **Estado** — categoria não representa condição operacional
- ❌ **Capacidade** — categoria não indica habilidade ou competência
- ❌ **Autoridade** — categoria não confere poder ou acesso

---

## ESCOPOS PERMITIDOS (EXPLÍCITOS)

Categorias **PODEM** ser usadas para:

### 1. Visualização
- Exibir categorias em listagens
- Mostrar hierarquia de categorias
- Renderizar árvore de navegação
- Apresentar filtros visuais

**Exemplo permitido:**
```typescript
// ✅ PERMITIDO: Exibir categorias em UI
const categories = await categoriesService.getCategories();
return <CategoryTree categories={categories} />;
```

### 2. Navegação
- Filtrar resultados por categoria (ação humana explícita)
- Agrupar itens por categoria para exibição
- Criar breadcrumbs baseados em categoria
- Navegar hierarquia de categorias

**Exemplo permitido:**
```typescript
// ✅ PERMITIDO: Filtro humano explícito
if (userSelectedCategory) {
  items = items.filter(item => item.categoryId === userSelectedCategory);
}
```

### 3. Agrupamento Informativo
- Agrupar produtos por categoria para visualização
- Organizar serviços por categoria em listagens
- Criar seções baseadas em categoria

**Exemplo permitido:**
```typescript
// ✅ PERMITIDO: Agrupamento para exibição
const grouped = items.reduce((acc, item) => {
  const cat = item.categoryId;
  if (!acc[cat]) acc[cat] = [];
  acc[cat].push(item);
  return acc;
}, {});
```

### 4. Leitura Humana
- Exibir categoria como label descritivo
- Mostrar categoria em tooltips ou help text
- Incluir categoria em relatórios informativos
- Usar categoria em busca textual (não automática)

**Exemplo permitido:**
```typescript
// ✅ PERMITIDO: Label descritivo
<div>
  <h1>{product.name}</h1>
  <span className="category-label">{product.category.name}</span>
</div>
```

---

## ESCOPOS PROIBIDOS (BLOQUEIO ABSOLUTO)

Categorias **NUNCA PODEM** ser usadas para:

### 1. Decisão
- ❌ `if (category === 'X') { doSomething() }`
- ❌ `switch (category) { case 'Y': allow() }`
- ❌ Qualquer lógica condicional baseada em categoria

**Exemplo PROIBIDO:**
```typescript
// ❌ PROIBIDO: Decisão baseada em categoria
if (product.category === 'premium') {
  allowAccess(); // VIOLAÇÃO
}
```

### 2. Permissão
- ❌ Bloquear acesso por categoria
- ❌ Autorizar ação por categoria
- ❌ Verificar permissão usando categoria

**Exemplo PROIBIDO:**
```typescript
// ❌ PROIBIDO: Permissão por categoria
if (user.category === 'admin') {
  return true; // VIOLAÇÃO
}
```

### 3. Ranking
- ❌ Ordenar por categoria
- ❌ Priorizar por categoria
- ❌ Dar peso a resultados por categoria

**Exemplo PROIBIDO:**
```typescript
// ❌ PROIBIDO: Ranking por categoria
results.sort((a, b) => {
  if (a.category === 'featured') return -1; // VIOLAÇÃO
  return 0;
});
```

### 4. Priorização
- ❌ Dar prioridade por categoria
- ❌ Escalar por categoria
- ❌ Processar primeiro por categoria

**Exemplo PROIBIDO:**
```typescript
// ❌ PROIBIDO: Priorização por categoria
if (item.category === 'urgent') {
  processFirst(); // VIOLAÇÃO
}
```

### 5. Preço
- ❌ Calcular preço por categoria
- ❌ Aplicar desconto por categoria
- ❌ Definir taxa por categoria
- ❌ Influenciar split financeiro por categoria

**Exemplo PROIBIDO:**
```typescript
// ❌ PROIBIDO: Preço por categoria
if (product.category === 'luxury') {
  price = basePrice * 2; // VIOLAÇÃO
}
```

### 6. Impacto Financeiro
- ❌ Calcular split por categoria
- ❌ Aplicar taxa por categoria
- ❌ Definir comissão por categoria
- ❌ Influenciar valor financeiro por categoria

**Exemplo PROIBIDO:**
```typescript
// ❌ PROIBIDO: Split por categoria
const split = calculateSplit({
  category: product.category // VIOLAÇÃO
});
```

### 7. Visibilidade Sistêmica
- ❌ Ocultar por categoria
- ❌ Mostrar apenas por categoria
- ❌ Alterar visibilidade por categoria

**Exemplo PROIBIDO:**
```typescript
// ❌ PROIBIDO: Visibilidade por categoria
if (item.category === 'hidden') {
  return null; // VIOLAÇÃO
}
```

### 8. Automação
- ❌ Disparar ação por categoria
- ❌ Executar fluxo por categoria
- ❌ Acionar processo por categoria

**Exemplo PROIBIDO:**
```typescript
// ❌ PROIBIDO: Automação por categoria
if (event.category === 'automated') {
  autoApprove(); // VIOLAÇÃO
}
```

---

## POR QUE CATEGORIA NÃO É VERDADE

Categorias são **metadados mutáveis** e **interpretações humanas**.

### Categoria não é verdade porque:

1. **É mutável** — categorias podem ser renomeadas, reorganizadas ou removidas
2. **É subjetiva** — diferentes humanos podem categorizar o mesmo item de forma diferente
3. **É contextual** — uma categoria pode significar coisas diferentes em contextos diferentes
4. **É evolutiva** — taxonomias mudam com o tempo
5. **É descritiva** — categoria descreve, não define

### Se categoria fosse verdade:

- ❌ Sistema quebraria se categoria mudasse
- ❌ Comportamento dependeria de interpretação humana
- ❌ Decisões seriam baseadas em metadados mutáveis
- ❌ Auditoria seria impossível (categoria pode mudar)

---

## POR QUE CATEGORIA NÃO É POLICY

Categoria é **descrição**, não **regra**.

### Categoria não é policy porque:

1. **Policy é imutável** — regras de negócio não mudam sem versionamento
2. **Policy é auditável** — regras devem ter trilha de auditoria
3. **Policy é determinística** — mesma regra sempre produz mesmo resultado
4. **Policy é explícita** — regras são declaradas, não inferidas

### Se categoria fosse policy:

- ❌ Regras mudariam quando categoria mudasse
- ❌ Comportamento seria imprevisível
- ❌ Auditoria seria impossível
- ❌ Sistema seria frágil

---

## POR QUE CATEGORIA NÃO PODE EVOLUIR PARA DECISÃO

Categoria **NÃO PODE** evoluir para decisão porque:

1. **Violaria Decision Safety** — `Decision_Safety_and_Containment_Contract.md` proíbe decisão por categoria
2. **Violaria Database Canonical Truth** — categoria não é verdade, não pode decidir
3. **Violaria Observabilidade** — categoria é observação, não ação
4. **Criaria anticore** — decisão por categoria é proibida institucionalmente

---

## CONEXÃO COM OUTROS CONTRATOS

### Decision Safety and Containment Contract

**Citação explícita:**
> "É terminantemente proibido ao sistema: Decidir por **categoria**"

**Consequência:**
- Qualquer uso de categoria para decisão é **VIOLAÇÃO AUTOMÁTICA**
- Não há exceção, mitigação ou justificativa aceitável

### Database Canonical Truth Contract

**Citação explícita:**
> "The database stores **state**, not truth."

**Consequência:**
- Categoria é estado, não verdade
- Categoria não pode ser usada para decisões que dependem de verdade

### Observabilidade Constitucional

**Citação explícita:**
> "Observabilidade serve para: perceber padrões, expor tendências, manter consciência sistêmica"

**Consequência:**
- Categoria pode ser usada para observação (visualização)
- Categoria **NÃO pode** ser usada para ação (decisão)

---

## EXEMPLOS PERMITIDOS

### ✅ Exemplo 1: Visualização de Categorias
```typescript
// Exibir categorias em menu de navegação
const categories = await categoriesService.getCategories();
return <NavMenu categories={categories} />;
```

### ✅ Exemplo 2: Filtro Humano Explícito
```typescript
// Usuário seleciona categoria para filtrar
const selectedCategory = req.query.category; // Ação humana
const products = await productService.getProducts({
  categoryId: selectedCategory
});
```

### ✅ Exemplo 3: Agrupamento para Exibição
```typescript
// Agrupar produtos por categoria para visualização
const grouped = products.reduce((acc, p) => {
  if (!acc[p.categoryId]) acc[p.categoryId] = [];
  acc[p.categoryId].push(p);
  return acc;
}, {});
```

### ✅ Exemplo 4: Label Descritivo
```typescript
// Mostrar categoria como informação
<div>
  <h2>{product.name}</h2>
  <span>Category: {product.category.name}</span>
</div>
```

---

## EXEMPLOS PROIBIDOS

### ❌ Exemplo 1: Decisão por Categoria
```typescript
// PROIBIDO: Decisão baseada em categoria
if (product.category === 'premium') {
  allowAccess(); // VIOLAÇÃO
}
```

### ❌ Exemplo 2: Permissão por Categoria
```typescript
// PROIBIDO: Verificar permissão usando categoria
const canEdit = user.category === 'admin'; // VIOLAÇÃO
```

### ❌ Exemplo 3: Ranking por Categoria
```typescript
// PROIBIDO: Ordenar por categoria
results.sort((a, b) => {
  if (a.category === 'featured') return -1; // VIOLAÇÃO
  return 0;
});
```

### ❌ Exemplo 4: Preço por Categoria
```typescript
// PROIBIDO: Calcular preço baseado em categoria
const price = basePrice * (product.category === 'luxury' ? 2 : 1); // VIOLAÇÃO
```

### ❌ Exemplo 5: Split Financeiro por Categoria
```typescript
// PROIBIDO: Calcular split usando categoria
const split = calculateSplit({
  category: transaction.category // VIOLAÇÃO
});
```

---

## FRASES CANÔNICAS DE BLOQUEIO INSTITUCIONAL

As seguintes frases são **BLOQUEIO AUTOMÁTICO** para qualquer proposta:

1. **"Se categoria for X, então..."**
   - ❌ BLOQUEADO — categoria não pode condicionar comportamento

2. **"Categoria premium tem acesso especial"**
   - ❌ BLOQUEADO — categoria não pode conferir permissão

3. **"Priorizar itens da categoria Y"**
   - ❌ BLOQUEADO — categoria não pode priorizar

4. **"Aplicar desconto para categoria Z"**
   - ❌ BLOQUEADO — categoria não pode influenciar preço

5. **"Calcular split baseado em categoria"**
   - ❌ BLOQUEADO — categoria não pode influenciar split financeiro

6. **"Categoria determina visibilidade"**
   - ❌ BLOQUEADO — categoria não pode determinar visibilidade

7. **"Automatizar ação para categoria W"**
   - ❌ BLOQUEADO — categoria não pode acionar automação

---

## REGRA FINAL (INQUEBRÁVEL)

> **No UnifiCard, categoria é descrição, não decisão.  
> Categoria ajuda humanos a encontrar, não sistema a decidir.  
> Se categoria muda comportamento, é violação institucional.**

---

## AUTORIDADE DOCUMENTAL

Este documento é respaldado por:

- `Category_System_Contract_UnifiCard.md` — Define categorias como descritivas
- `Decision_Safety_and_Containment_Contract.md` — Proíbe decisão por categoria
- `Database_Canonical_Truth_Contract.md` — Define que categoria não é verdade
- `OBSERVABILIDADE_CONSTITUCIONAL.md` — Define que categoria é observação, não ação
- `MATRIZ_FONTES_DE_VERDADE.md` — Define fonte canônica de categorias

Este documento possui **precedência operacional** sobre qualquer interpretação, sugestão ou implementação que use categoria para decisão.

---

FIM DO DOCUMENTO CATEGORY_SCOPES_SEMANTICS.md


