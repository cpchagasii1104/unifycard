# CATEGORY SCOPES SEMANTICS — UNIFICARD

Status: SUBORDINATED  
Domain: Categories  
Governing Contract: CORE_CATEGORY_CONTRACT.md  
Authority Level: 2 (Subordinated Normative)  
Nature: Semantic Constraint Contract (Non-Executable)

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
2. Navegação
Filtrar resultados por categoria (ação humana explícita)

Agrupar itens por categoria para exibição

Criar breadcrumbs baseados em categoria

Navegar hierarquia de categorias

Exemplo permitido:

typescript
Copiar código
// ✅ PERMITIDO: Filtro humano explícito
if (userSelectedCategory) {
  items = items.filter(item => item.categoryId === userSelectedCategory);
}
3. Agrupamento Informativo
Agrupar produtos por categoria para visualização

Organizar serviços por categoria em listagens

Criar seções baseadas em categoria

Exemplo permitido:

typescript
Copiar código
// ✅ PERMITIDO: Agrupamento para exibição
const grouped = items.reduce((acc, item) => {
  const cat = item.categoryId;
  if (!acc[cat]) acc[cat] = [];
  acc[cat].push(item);
  return acc;
}, {});
4. Leitura Humana
Exibir categoria como label descritivo

Mostrar categoria em tooltips ou help text

Incluir categoria em relatórios informativos

Usar categoria em busca textual (não automática)

Exemplo permitido:

typescript
Copiar código
// ✅ PERMITIDO: Label descritivo
<div>
  <h1>{product.name}</h1>
  <span className="category-label">{product.category.name}</span>
</div>
ESCOPOS PROIBIDOS (BLOQUEIO ABSOLUTO)
Categorias NUNCA PODEM ser usadas para:

1. Decisão
typescript
Copiar código
// ❌ PROIBIDO
if (product.category === 'premium') {
  allowAccess();
}
2. Permissão
typescript
Copiar código
// ❌ PROIBIDO
if (user.category === 'admin') {
  return true;
}
3. Ranking
typescript
Copiar código
// ❌ PROIBIDO
results.sort((a, b) => {
  if (a.category === 'featured') return -1;
  return 0;
});
4. Priorização
typescript
Copiar código
// ❌ PROIBIDO
if (item.category === 'urgent') {
  processFirst();
}
5. Preço
typescript
Copiar código
// ❌ PROIBIDO
if (product.category === 'luxury') {
  price = basePrice * 2;
}
6. Impacto Financeiro
typescript
Copiar código
// ❌ PROIBIDO
calculateSplit({ category: transaction.category });
7. Visibilidade Sistêmica
typescript
Copiar código
// ❌ PROIBIDO
if (item.category === 'hidden') {
  return null;
}
8. Automação
typescript
Copiar código
// ❌ PROIBIDO
if (event.category === 'automated') {
  autoApprove();
}
POR QUE CATEGORIA NÃO É VERDADE
Categorias são metadados mutáveis e interpretações humanas.

Se categoria fosse verdade:

comportamento mudaria com renomeação

auditoria seria impossível

sistema seria frágil

POR QUE CATEGORIA NÃO É POLICY
Categoria descreve.
Policy governa.

Misturar os dois quebra:

auditabilidade

determinismo

segurança decisória

CONEXÃO COM OUTROS CONTRATOS
Este documento é subordinado a:

CORE_CATEGORY_CONTRACT.md

Decision_Safety_and_Containment_Contract.md

OBSERVABILIDADE_CONSTITUCIONAL.md

MATRIZ_FONTES_DE_VERDADE.md

REGRA FINAL (INQUEBRÁVEL)
No UnifiCard, categoria é descrição, não decisão.
Se categoria muda comportamento, há violação institucional.

FIM DO DOCUMENTO CATEGORY_SCOPES_SEMANTICS.md